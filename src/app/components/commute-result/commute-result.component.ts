import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommuterSchedule, JourneyTime, MapLocation } from '../../model/motorcycle.model';

@Component({
  selector: 'app-commute-result',
  imports: [CommonModule],
  templateUrl: './commute-result.component.html',
  styleUrl: './commute-result.component.css'
})
export class CommuteResultComponent {

  @Input() weekDays: CommuterSchedule[] = [];
  @Input() homeToWork: JourneyTime = { departure: '08:00', arrival: '09:00' };
  @Input() workToHome: JourneyTime = { departure: '17:00', arrival: '18:00' };
  @Input() showResults: boolean = false;
  @Input() homeLocation: MapLocation | null = null;
  @Input() workLocation: MapLocation | null = null;
  @Output() showRoute = new EventEmitter<void>();

  getWorkingDays(): CommuterSchedule[] {
    return this.weekDays.filter(day => day.isWorking);
  }

  getRainColorClass(probability: number): string {
    if (probability < 30) return 'text-green-600';
    if (probability < 60) return 'text-yellow-600';
    return 'text-red-600';
  }

  getRainBarClass(probability: number): string {
    if (probability < 30) return 'bg-green-500';
    if (probability < 60) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  getClearDays(): number {
    return this.weekDays.filter(day =>
      day.isWorking &&
      day.rainProbability.homeToWork < 30 &&
      day.rainProbability.workToHome < 30
    ).length;
  }

  getRainyDays(): number {
    return this.weekDays.filter(day =>
      day.isWorking &&
      (day.rainProbability.homeToWork >= 30 || day.rainProbability.workToHome >= 30)
    ).length;
  }

  getHighestRainDay(): { day: string; probability: number } | null {
    let highest = { day: '', probability: 0 };

    this.weekDays.forEach(day => {
      if (day.isWorking) {
        if (day.rainProbability.homeToWork > highest.probability) {
          highest = {
            day: day.label,
            probability: day.rainProbability.homeToWork
          };
        }
        if (day.rainProbability.workToHome > highest.probability) {
          highest = {
            day: day.label,
            probability: day.rainProbability.workToHome
          };
        }
      }
    });

    return highest.probability > 0 ? highest : null;
  }

  onShowRoute() {
    this.showRoute.emit();
  }
}
