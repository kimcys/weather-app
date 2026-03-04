import { 
  Component, 
  Input, 
  Output, 
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  NgZone,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherForecast } from '../../model/forecast.model';
import { WeatherUtils } from '../../utils/weather-utils';

@Component({
  selector: 'app-weather-cards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weather-cards.component.html',
  styleUrls: ['./weather-cards.component.css']
})
export class WeatherCardsComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  @Input() selectedForecast: WeatherForecast | null = null;
  @Input() uniqueDates: string[] = [];
  @Input() locations: string[] = [];
  @Input() forecasts: WeatherForecast[] = [];
  @Input() filteredDate: string = '';
  @Input() selectedLocationType: string = 'Ds';
  @Input() locationTypes = [
    { value: 'Ds', label: 'Daerah' },
  ];

  @Output() onDateFilter = new EventEmitter<string>();
  @Output() onLocationTypeFilter = new EventEmitter<string>();
  @Output() onResetFilter = new EventEmitter<void>();
  @Output() onLocationSelect = new EventEmitter<string>();

  canScrollLeft = false;
  canScrollRight = true;
  private scrollInterval: any;
  private readonly SCROLL_SPEED = 0.8; // pixels per frame
  private readonly AUTO_SCROLL_DELAY = 3000; // 3 seconds
  private otherLocations: string[] = [];

  constructor(private ngZone: NgZone) {}

  ngOnInit() {
    this.updateOtherLocations();
  }

  ngAfterViewInit() {
    this.startAutoScroll();
    this.checkScrollButtons();
  }

  ngOnDestroy() {
    this.stopAutoScroll();
  }

  private updateOtherLocations() {
    if (this.selectedForecast) {
      this.otherLocations = this.locations.filter(
        loc => loc !== this.selectedForecast?.location?.location_name
      );
    } else {
      this.otherLocations = [...this.locations];
    }
  }

  // Get locations excluding the selected one
  getOtherLocations(): string[] {
    if (this.selectedForecast) {
      return this.locations.filter(
        loc => loc !== this.selectedForecast?.location?.location_name
      );
    }
    return this.locations;
  }

  // Utility methods
  getWeatherEmoji = WeatherUtils.getWeatherEmoji;

  getForecastsForLocation(location: string): WeatherForecast[] {
    return this.forecasts.filter(f => f.location.location_name === location);
  }

  getLatestForecastEmoji(location: string): string {
    const forecasts = this.getForecastsForLocation(location);
    if (forecasts.length === 0) return '☀️';
    const latest = WeatherUtils.getLatestForecast(forecasts);
    return WeatherUtils.getWeatherEmoji(latest.summary_forecast);
  }

  getLatestForecastSummary(location: string): string {
    const forecasts = this.getForecastsForLocation(location);
    if (forecasts.length === 0) return '';
    const latest = WeatherUtils.getLatestForecast(forecasts);
    return latest.summary_forecast;
  }

  getLatestForecastTemp(location: string): string {
    const forecasts = this.getForecastsForLocation(location);
    if (forecasts.length === 0) return '';
    const latest = WeatherUtils.getLatestForecast(forecasts);
    return `${latest.min_temp}° - ${latest.max_temp}°`;
  }

  isSelectedLocation(location: string): boolean {
    return this.selectedForecast?.location?.location_name === location;
  }

  trackByLocation(index: number, location: string): string {
    return location;
  }

  // Scroll methods
  scrollLeft() {
    const container = this.scrollContainer.nativeElement;
    const cardWidth = 240; // 224px width + 16px gap
    container.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    setTimeout(() => this.checkScrollButtons(), 300);
  }

  scrollRight() {
    const container = this.scrollContainer.nativeElement;
    const cardWidth = 240; // 224px width + 16px gap
    container.scrollBy({ left: cardWidth, behavior: 'smooth' });
    setTimeout(() => this.checkScrollButtons(), 300);
  }

  onScroll() {
    this.checkScrollButtons();
    this.handleInfiniteLoop();
  }

  private checkScrollButtons() {
    if (this.scrollContainer) {
      const container = this.scrollContainer.nativeElement;
      this.canScrollLeft = container.scrollLeft > 10;
      this.canScrollRight = container.scrollLeft < container.scrollWidth - container.clientWidth - 10;
    }
  }

  private handleInfiniteLoop() {
    const container = this.scrollContainer.nativeElement;
    const halfScrollWidth = container.scrollWidth / 2;

    // If scrolled past the first set, jump back to the beginning
    if (container.scrollLeft >= halfScrollWidth && halfScrollWidth > 0) {
      container.scrollLeft = 0;
    }
    // If scrolled before the first set, jump to the second set
    else if (container.scrollLeft < 0) {
      container.scrollLeft = halfScrollWidth - container.clientWidth;
    }
  }

  // Auto-scroll methods
  private startAutoScroll() {
    this.ngZone.runOutsideAngular(() => {
      this.scrollInterval = setInterval(() => {
        this.ngZone.run(() => {
          if (this.scrollContainer && this.canScrollRight) {
            const container = this.scrollContainer.nativeElement;
            const maxScroll = container.scrollWidth - container.clientWidth;
            
            if (container.scrollLeft >= maxScroll - 10) {
              // Jump to start for infinite effect
              container.scrollLeft = 0;
            } else {
              container.scrollLeft += this.SCROLL_SPEED;
            }
            this.checkScrollButtons();
          }
        });
      }, 30); // ~30fps
    });
  }

  private stopAutoScroll() {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
    }
  }

  // Pause auto-scroll on hover
  pauseAutoScroll() {
    this.stopAutoScroll();
  }

  resumeAutoScroll() {
    this.startAutoScroll();
  }
}