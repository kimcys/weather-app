import { Component } from '@angular/core';
import { WeatherMapComponent } from './components/weather-map/weather-map.component';

@Component({
  selector: 'app-root',
  imports: [WeatherMapComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'weather-app';
}
