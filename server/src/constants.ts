// 0 - Tram, Streetcar, Light rail. Any light rail or street level system within a metropolitan area.
// 1 - Subway, Metro. Any underground rail system within a metropolitan area.
// 2 - Rail. Used for intercity or long-distance travel.
// 3 - Bus. Used for short- and long-distance bus routes.
// 4 - Ferry. Used for short- and long-distance boat service.
// 5 - Cable tram. Used for street-level rail cars where the cable runs beneath the vehicle (e.g., cable car in San Francisco).
// 6 - Aerial lift, suspended cable car (e.g., gondola lift, aerial tramway). Cable transport where cabins, cars, gondolas or open chairs are suspended by means of one or more cables.
// 7 - Funicular. Any rail system designed for steep inclines.
// 11 - Trolleybus. Electric buses that draw power from overhead wires using poles.
// 12 - Monorail. Railway in which the track consists of a single rail or a beam.

export const ROUTE_TYPES: Record<number, string> = {
  0: "TRAM",
  1: "SUBWAY",
  2: "RAIL",
  3: "BUS",
  4: "FERRY",
  5: "CABLE_TRAM",
  6: "AERIAL_LIFT",
  7: "FUNICULAR",
  11: "TROLLEYBUS",
  12: "MONORAIL",
};

export type eRouteType = keyof typeof ROUTE_TYPES;

// 0 (or empty) - Stop (or Platform). A location where passengers board or disembark from a transit vehicle. Is called a platform when defined within a parent_station.
// 1 - Station. A physical structure or area that contains one or more platform.
// 2 - Entrance/Exit. A location where passengers can enter or exit a station from the street. If an entrance/exit belongs to multiple stations, it may be linked by pathways to both, but the data provider must pick one of them as parent.
// 3 - Generic Node. A location within a station, not matching any other location_type, that may be used to link together pathways define in pathways.txt.
// 4 - Boarding Area. A specific location on a platform, where passengers can board and/or alight vehicles.

export const LOCATION_TYPES: Record<number, string> = {
  0: "STOP",
  1: "STATION",
  2: "ENTRANCE_EXIT",
  3: "GENERIC_NODE",
  4: "BOARDING_AREA",
};

export type eLocationType = keyof typeof LOCATION_TYPES;

export const WHEELCHAIR_BOARDING: Record<number, string> = {
  0: "UNKNOWN",
  1: "AVAILABLE",
  2: "UNAVAILABLE",
};

export type eWheelchairBoarding = keyof typeof WHEELCHAIR_BOARDING;

export const BIKES_ALLOWED: Record<number, string> = {
  0: "UNKNOWN",
  1: "ALLOWED",
  2: "NOT_ALLOWED",
};

export type eBikesAllowed = keyof typeof BIKES_ALLOWED;
