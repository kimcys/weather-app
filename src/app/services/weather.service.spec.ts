import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WeatherService } from './weather.service';
import { WeatherForecast } from '../model/forecast.model';

describe('WeatherService', () => {
  let service: WeatherService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WeatherService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(WeatherService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch forecast data from the forecast endpoint', () => {
    const mockForecasts: WeatherForecast[] = [
      {
        location: {
          location_id: '1',
          location_name: 'Kuala Lumpur',
          latitude: 3.139,
          longitude: 101.6869
        },
        date: '2026-02-26',
        morning_forecast: 'Cerah',
        afternoon_forecast: 'Hujan',
        night_forecast: 'Mendung',
        summary_forecast: 'Hujan',
        summary_when: 'Afternoon',
        min_temp: 24,
        max_temp: 32
      }
    ];

    service.getForecast().subscribe((forecasts) => {
      expect(forecasts).toEqual(mockForecasts);
    });

    const req = httpMock.expectOne('https://api.data.gov.my/weather/forecast');
    expect(req.request.method).toBe('GET');
    req.flush(mockForecasts);
  });

  it('should combine forecast, warning, and earthquake responses', () => {
    const mockForecasts: WeatherForecast[] = [
      {
        location: {
          location_id: '1',
          location_name: 'Kuala Lumpur',
          latitude: 3.139,
          longitude: 101.6869
        },
        date: '2026-02-26',
        morning_forecast: 'Cerah',
        afternoon_forecast: 'Hujan',
        night_forecast: 'Mendung',
        summary_forecast: 'Hujan',
        summary_when: 'Afternoon',
        min_temp: 24,
        max_temp: 32
      }
    ];
    const mockWarnings = [{ id: 'warn-1', title: 'Ribut petir' }];
    const mockEarthquakes = [{ id: 'eq-1', magnitude: 4.8 }];

    service.getAllWeatherData().subscribe((result) => {
      expect(result).toEqual({
        forecast: mockForecasts,
        warnings: mockWarnings,
        earthquakes: mockEarthquakes
      });
    });

    const forecastReq = httpMock.expectOne('https://api.data.gov.my/weather/forecast');
    const warningReq = httpMock.expectOne('https://api.data.gov.my/weather/warning');
    const earthquakeReq = httpMock.expectOne('https://api.data.gov.my/weather/warning/earthquake');

    expect(forecastReq.request.method).toBe('GET');
    expect(warningReq.request.method).toBe('GET');
    expect(earthquakeReq.request.method).toBe('GET');

    forecastReq.flush(mockForecasts);
    warningReq.flush(mockWarnings);
    earthquakeReq.flush(mockEarthquakes);
  });
});
