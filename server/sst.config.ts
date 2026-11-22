/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "gtfs",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: input?.stage === "production",
      home: "aws",
      providers: {
        aws: { profile: process.env.AWS_PROFILE ?? "personal", region: "eu-central-1" },
      },
    };
  },
  async run() {
    // Preview stages (anything but production) deploy only the web app, with
    // /graphql proxied to the production API. No secrets, data or domain needed.
    if ($app.stage !== "production") {
      const router = new sst.aws.Router("Router");
      router.route("/graphql", "https://gtfs.szalay.me");
      const web = new sst.aws.StaticSite("Web", {
        path: "../web",
        build: { command: "pnpm install && pnpm run build", output: "dist" },
        router: { instance: router },
      });
      return { url: web.url };
    }

    const bucket = new sst.aws.Bucket("Gtfs");
    const bkkApiKey = new sst.Secret("BkkApiKey");
    const mavAuth = new sst.Secret("MavAuth");

    // Static timetable: rebuilt daily in a Fargate task (gtfs-import needs the
    // native better-sqlite3 module and can run longer than Lambda's 15 min).
    // Uses the account's default VPC with public subnets, so no NAT gateway.
    const vpc = await aws.ec2.getVpc({ default: true });
    const subnets = await aws.ec2.getSubnets({
      filters: [{ name: "vpc-id", values: [vpc.id] }],
    });
    const securityGroup = await aws.ec2.getSecurityGroup({
      vpcId: vpc.id,
      name: "default",
    });
    const cluster = new sst.aws.Cluster("Cluster", {
      vpc: {
        id: vpc.id,
        securityGroups: [securityGroup.id],
        containerSubnets: subnets.ids,
        loadBalancerSubnets: subnets.ids,
      },
    });
    const importTask = new sst.aws.Task("Import", {
      cluster,
      architecture: "arm64",
      cpu: "1 vCPU",
      memory: "6 GB",
      image: { context: ".", dockerfile: "Dockerfile" },
      link: [bucket, mavAuth],
      publicIp: true,
      dev: false,
    });
    new sst.aws.CronV2("ImportSchedule", {
      task: importTask,
      schedule: "cron(30 3 * * ? *)",
      timezone: "Europe/Budapest",
    });
    // Every 3 hours too: BKK republishes its timetable during the day, and the job exits at once when nothing changed
    new sst.aws.CronV2("ImportScheduleHourly", {
      task: importTask,
      schedule: "cron(0 */3 * * ? *)",
      timezone: "Europe/Budapest",
    });

    // GraphQL API: reads the timetable from S3 into /tmp, fetches realtime
    // feeds on demand.
    const api = new sst.aws.ApiGatewayV2("Api");
    api.route("ANY /", {
      handler: "src/lambda.handler",
      architecture: "arm64",
      memory: "1769 MB",
      // Room for two copies of the timetable while swapping in a new import
      storage: "6 GB",
      timeout: "29 seconds",
      link: [bucket, bkkApiKey],
    });

    // budapestgone.com (+ www): the web app at /, the GraphQL API at /graphql.
    // gtfs.szalay.me stays as an alias so existing installs (and their favourites, which are per-origin) keep working.
    // DNS records go to each name's own Route 53 zone, found by name (budapestgone.com is Z02820692S236ULT02D3;
    // a single fixed `zone` would break the szalay.me alias).
    const router = new sst.aws.Router("Router", {
      domain: {
        name: "budapestgone.com",
        aliases: ["www.budapestgone.com", "gtfs.szalay.me"],
      },
    });
    router.route("/graphql", api.url, {
      rewrite: { regex: "^/graphql.*$", to: "/" },
    });
    const web = new sst.aws.StaticSite("Web", {
      path: "../web",
      build: { command: "pnpm install && pnpm run build", output: "dist" },
      router: { instance: router },
    });

    return {
      url: web.url,
      api: api.url,
      importTask: importTask.taskDefinition,
    };
  },
});
