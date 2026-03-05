import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JourneyTime, MapLocation } from '../../model/motorcycle.model';

declare var google: any;

@Component({
  selector: 'app-motorcycle-commuter',
  imports: [CommonModule, FormsModule],
  templateUrl: './motorcycle-commuter.component.html',
  styleUrl: './motorcycle-commuter.component.css'
})
export class MotorcycleCommuterComponent {
  @ViewChild('homeSearchInput') homeSearchInput!: ElementRef;
  @ViewChild('workSearchInput') workSearchInput!: ElementRef;

  @Output() calculate = new EventEmitter<{
    homeLocation: MapLocation;
    workLocation: MapLocation;
    homeToWork: JourneyTime;
    workToHome: JourneyTime;
    weekDays: any[];
  }>();

  // Google Maps Autocomplete
  homeAutocomplete: any;
  workAutocomplete: any;

  selectedHomeLocation: MapLocation | null = null;
  selectedWorkLocation: MapLocation | null = null;

  homeLocation: string = '';
  workLocation: string = '';

  // Journey times (apply to all days)
  homeToWork: JourneyTime = { departure: '08:00', arrival: '09:00' };
  workToHome: JourneyTime = { departure: '17:00', arrival: '18:00' };

  journeyDuration: string = '~60 minit';

  weekDays = [
    { day: 'Monday', label: 'Isnin', isWorking: true },
    { day: 'Tuesday', label: 'Selasa', isWorking: true },
    { day: 'Wednesday', label: 'Rabu', isWorking: true },
    { day: 'Thursday', label: 'Khamis', isWorking: true },
    { day: 'Friday', label: 'Jumaat', isWorking: true },
    { day: 'Saturday', label: 'Sabtu', isWorking: false },
    { day: 'Sunday', label: 'Ahad', isWorking: false }
  ];

  timeSlots: string[] = this.generateTimeSlots();

  ngAfterViewInit() {
    this.initAutocomplete();
  }

  private generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute of ['00', '30']) {
        slots.push(`${hour.toString().padStart(2, '0')}:${minute}`);
      }
    }
    return slots;
  }

  private initAutocomplete() {
    if (typeof google !== 'undefined' && google.maps) {
      // Home location autocomplete
      this.homeAutocomplete = new google.maps.places.Autocomplete(this.homeSearchInput.nativeElement, {
        types: ['establishment'],
        componentRestrictions: { country: 'my' }
      });

      this.homeAutocomplete.addListener('place_changed', () => {
        const place = this.homeAutocomplete.getPlace();
        if (place.geometry) {
          this.selectedHomeLocation = {
            name: place.name || place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address
          };
          this.homeLocation = place.formatted_address;
          this.calculateJourneyDuration();
        }
      });

      // Work location autocomplete
      this.workAutocomplete = new google.maps.places.Autocomplete(this.workSearchInput.nativeElement, {
        types: ['establishment'],
        componentRestrictions: { country: 'my' }
      });

      this.workAutocomplete.addListener('place_changed', () => {
        const place = this.workAutocomplete.getPlace();
        if (place.geometry) {
          this.selectedWorkLocation = {
            name: place.name || place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address
          };
          this.workLocation = place.formatted_address;
          this.calculateJourneyDuration();
        }
      });
    }
  }

  private calculateJourneyDuration() {
    if (this.selectedHomeLocation && this.selectedWorkLocation && typeof google !== 'undefined') {
      const service = new google.maps.DistanceMatrixService();

      service.getDistanceMatrix({
        origins: [this.selectedHomeLocation.address],
        destinations: [this.selectedWorkLocation.address],
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
      }, (response: any, status: string) => {
        if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
          const duration = response.rows[0].elements[0].duration.text;
          this.journeyDuration = duration;
        }
      });
    }
  }

  onLocationChange() {
    // Clear any previous selection if needed
  }

  onFormChange() {
    // Handle form changes if needed
  }

  isFormValid(): boolean {
    return this.selectedHomeLocation !== null &&
      this.selectedWorkLocation !== null &&
      this.selectedHomeLocation.address !== this.selectedWorkLocation.address &&
      this.weekDays.some(day => day.isWorking);
  }

  getWorkingDaysCount(): number {
    return this.weekDays.filter(day => day.isWorking).length;
  }


  onCalculate() {
    if (this.selectedHomeLocation && this.selectedWorkLocation) {
      this.calculate.emit({
        homeLocation: this.selectedHomeLocation,
        workLocation: this.selectedWorkLocation,
        homeToWork: this.homeToWork,
        workToHome: this.workToHome,
        weekDays: this.weekDays
      });
    }
  }
}