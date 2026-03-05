import { Injectable, Inject, PLATFORM_ID, Renderer2, RendererFactory2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentThemeSubject = new BehaviorSubject<Theme>('light');
  currentTheme$ = this.currentThemeSubject.asObservable();
  private renderer: Renderer2;
  
  constructor(
    private rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.initializeTheme();
  }
  
  private initializeTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Check localStorage first
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      
      if (savedTheme) {
        console.log('Loading saved theme:', savedTheme);
        this.setTheme(savedTheme);
      } else {
        // Check system preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = systemPrefersDark ? 'dark' : 'light';
        console.log('Using system preference:', initialTheme);
        this.setTheme(initialTheme);
      }
      
      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }
  }
  
  setTheme(theme: Theme): void {
    if (isPlatformBrowser(this.platformId)) {
      console.log('Setting theme to:', theme);
      
      // Update HTML class using Renderer2
      if (theme === 'dark') {
        this.renderer.addClass(this.document.documentElement, 'dark');
      } else {
        this.renderer.removeClass(this.document.documentElement, 'dark');
      }
      
      // Save to localStorage
      localStorage.setItem('theme', theme);
      
      // Update BehaviorSubject
      this.currentThemeSubject.next(theme);
      
      // Debug: Check if class was applied
      console.log('HTML class after update:', this.document.documentElement.classList);
    }
  }
  
  toggleTheme(): void {
    const currentTheme = this.currentThemeSubject.value;
    this.setTheme(currentTheme === 'light' ? 'dark' : 'light');
  }
  
  isDarkMode(): boolean {
    return this.currentThemeSubject.value === 'dark';
  }
}