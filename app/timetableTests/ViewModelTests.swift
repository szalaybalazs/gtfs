import Testing
import TimetableAPI
@testable import timetable

@MainActor
struct RoutesViewModelTests {
    @Test func loadsPagesUntilLast() async {
        let client = MockGraphQLClient()
        client.responses = [
            { _ in Fixtures.routesPage(page: 0, pages: 1, ids: ["1", "2"]) },
            { _ in Fixtures.routesPage(page: 1, pages: 1, ids: ["3"]) },
        ]
        let vm = RoutesViewModel(client: client)

        await vm.loadNextPage()
        await vm.loadNextPage()
        await vm.loadNextPage() // no more pages: must not hit the network

        #expect(vm.routes.map(\.routeId) == ["1", "2", "3"])
        #expect(client.queries.count == 2)
        #expect((client.queries[1] as? RoutesQuery)?.page == .some(1))
        #expect(vm.hasMore == false)
    }

    @Test func errorThenRetryRecovers() async {
        let client = MockGraphQLClient()
        client.responses = [
            { _ in throw TestError() },
            { _ in Fixtures.routesPage(page: 0, pages: 0, ids: ["1"]) },
        ]
        let vm = RoutesViewModel(client: client)

        await vm.loadNextPage()
        #expect(vm.state == .failed("offline"))

        await vm.reload()
        #expect(vm.state == .idle)
        #expect(vm.routes.count == 1)
    }
}

@MainActor
struct RouteDetailsViewModelTests {
    @Test func selectsDirectionContainingClosestStop() async {
        let client = MockGraphQLClient()
        client.responses = [{ _ in Fixtures.route(closestStopId: "D") }]
        let vm = RouteDetailsViewModel(routeId: "R1", client: client, locate: { nil })

        await vm.load()

        #expect(vm.directionId == 1)
        #expect(vm.stopId == "D")
    }

    @Test func fallsBackToFirstStop() async {
        let client = MockGraphQLClient()
        client.responses = [{ _ in Fixtures.route(closestStopId: nil) }]
        let vm = RouteDetailsViewModel(routeId: "R1", client: client, locate: { nil })

        await vm.load()

        #expect(vm.directionId == 0)
        #expect(vm.stopId == "A")
    }

    @Test func changingDirectionPicksAStopInIt() async {
        let client = MockGraphQLClient()
        client.responses = [{ _ in Fixtures.route(closestStopId: nil) }]
        let vm = RouteDetailsViewModel(routeId: "R1", client: client, locate: { nil })
        await vm.load()

        vm.directionId = 1
        vm.directionChanged()

        #expect(vm.stopId == "C")
    }
}

@MainActor
struct TimetableViewModelTests {
    @Test func failureSetsErrorAndClearsEntries() async {
        let client = MockGraphQLClient()
        client.responses = [{ _ in throw TestError() }]
        let vm = TimetableViewModel(client: client)

        await vm.load(routeId: "R1", stopId: "A")

        #expect(vm.state.errorMessage == "offline")
        #expect(vm.entries.isEmpty)
    }
}
