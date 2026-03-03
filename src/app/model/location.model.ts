export interface Location {
    id: string;
    name: string;
    lat: number;
    lng: number;
    type: string;
    createdAt: string;
    updatedAt: string;
}

export interface LocationsResponse {
    items: Location[];
}
