import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LocationsResponse } from '../model/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationService {

  private apiUrl = 'https://weather-be.fly.dev/locations';

  constructor(private http: HttpClient) { }

  getLocations(): Observable<LocationsResponse> {
    return this.http.get<LocationsResponse>(`${this.apiUrl}`);
  }
}