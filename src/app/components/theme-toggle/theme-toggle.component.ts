import { Component, OnInit } from '@angular/core';
import { ThemeService } from '../../services/theme.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-theme-toggle',
  imports: [CommonModule],
  templateUrl: './theme-toggle.component.html'
})
export class ThemeToggleComponent implements OnInit {
  isDarkMode = false;

  constructor(private themeService: ThemeService) {
    // Log to verify service is injected
    console.log('ThemeToggleComponent initialized');
  }

  ngOnInit() {
    // Subscribe to theme changes
    this.themeService.currentTheme$.subscribe(theme => {
      console.log('Theme changed to:', theme);
      this.isDarkMode = theme === 'dark';
    });
  }

  toggleTheme() {
    console.log('Toggle button clicked');
    this.themeService.toggleTheme();
  }
}