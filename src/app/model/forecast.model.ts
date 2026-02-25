export interface WeatherForecast {
    location: {
        location_id: string;
        location_name: string;
        latitude: string | number;
        longitude: string | number;
    };
    date: string;
    morning_forecast: string;
    afternoon_forecast: string;
    night_forecast: string;
    summary_forecast: string;
    summary_when: string;
    min_temp: number;
    max_temp: number;
}