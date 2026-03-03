import { TestBed } from '@angular/core/testing';

import { LocationMatcherService } from './location-matcher.service';

describe('LocationMatcherService', () => {
  let service: LocationMatcherService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocationMatcherService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
