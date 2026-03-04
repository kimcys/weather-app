export interface CommuterSchedule {
    day: string;
    label: string;
    isWorking: boolean;
    rainProbability: {
        homeToWork: number;
        workToHome: number;
    };
}

export interface HourlyWeather {
    time: string[];
    precipitation_probability: number[];
    temperature_2m: number[];
}

export interface JourneyTime {
    departure: string;
    arrival: string;
}

export interface MapLocation {
    name: string;
    lat: number;
    lng: number;
    address: string;
}


export interface HourlyWeather {
    time: string[];
    precipitation_probability: number[];
    temperature_2m: number[];
}

export interface WeatherApiResponse {
    latitude: number;
    longitude: number;
    generationtime_ms: number;
    utc_offset_seconds: number;
    timezone: string;
    timezone_abbreviation: string;
    elevation: number;
    hourly_units: {
        time: string;
        precipitation_probability: string;
        temperature_2m: string;
    };
    hourly: HourlyWeather;
}