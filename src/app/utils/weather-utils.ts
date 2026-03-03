import { WeatherForecast } from "../model/forecast.model";

export class WeatherUtils {

    static getWeatherEmoji(forecast?: string): string {
        const text = (forecast ?? '').trim().toLowerCase();
        if (text.includes('ribut') || text.includes('petir')) return '⛈️';
        if (text.includes('hujan')) {
            if (text.includes('lebat')) return '🌧️💧';
            if (text.includes('renek') || text.includes('renyai')) return '🌦️';
            return '🌧️';
        }
        if (text.includes('mendung') || text.includes('berawan')) return '☁️';
        if (text.includes('cerah') || text.includes('panas')) return '☀️';
        if (text.includes('kabut') || text.includes('kabus')) return '🌫️';
        if (text.includes('tiada hujan') || text.includes('tanpa hujan')) return '☀️';
        return '☀️';
    }

    static getWeatherColor(forecast?: string): string {
        const text = (forecast ?? '').trim().toLowerCase();
        if (text.includes('ribut') || text.includes('petir')) return '#ef4444';
        if (text.includes('hujan')) {
            if (text.includes('lebat')) return '#1e40af';
            return '#3b82f6';
        }
        if (text.includes('mendung') || text.includes('berawan')) return '#6b7280';
        if (text.includes('kabut') || text.includes('kabus')) return '#9ca3af';
        return '#10b981';
    }

    static groupForecastsByLocation(forecasts: WeatherForecast[]): Map<string, WeatherForecast[]> {
        const groups = new Map<string, WeatherForecast[]>();
        forecasts.forEach(forecast => {
            const location = forecast.location.location_name;
            if (!groups.has(location)) {
                groups.set(location, []);
            }
            groups.get(location)?.push(forecast);
        });
        return groups;
    }

    static getLatestForecast(forecasts: WeatherForecast[]): WeatherForecast {
        return forecasts
            .slice()
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    }
}