import { WeatherForecast } from "../model/forecast.model";

export class WeatherUtils {

    static getWeatherEmoji(summary?: string | null): string {
        const s = (summary ?? '')
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');

        if (!s) return '❓';

        if (s.includes('tiada hujan')) return '☀️';
        if (s.includes('ribut') || s.includes('petir')) return '⛈️';
        if (s.includes('renyai')) return '🌦️';
        if (s.includes('hujan')) return '🌧️';
        if (s.includes('berawan')) return '⛅️';
        if (s.includes('mendung') || s.includes('awan')) return '☁️';
        if (s.includes('jerebu') || s.includes('berjerebu')) return '🌫️';

        return '❓';
    }

    static getWeatherColor(forecast?: string): string {
        const s = (forecast ?? '')
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');

        if (s.includes('tiada hujan') || s.includes('cerah')) return '#f97316';
        if (s.includes('ribut') || s.includes('petir')) return '#0b1f4d';
        if (s.includes('renyai')) return '#93c5fd';
        if (s.includes('hujan')) {
            if (s.includes('lebat')) return '#1e3a8a';
            return '#3b82f6';
        }
        if (s.includes('mendung') || s.includes('berawan')) return '#6b7280';
        if (s.includes('kabut') || s.includes('kabus') || s.includes('jerebu')) return '#9ca3af';
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