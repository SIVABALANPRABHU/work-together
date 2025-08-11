export const officeLayout = {
  'main-office': {
    name: 'Main Office',
    grid: [
      ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'F', 'W'],
      ['W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W', 'W']
    ]
  }
};

export const officeObjects = {
  'main-office': [
    // Workstation 1 - Left side
    { type: 'desk-wood', x: 2, y: 2, hasComputer: true, hasMonitor: true, hasKeyboard: true, hasMouse: true, hasPlant: true, hasLamp: false, hasCoffee: true, hasNotebook: true, hasPhone: false, hasBooks: true },
    { type: 'office-chair', x: 2, y: 3, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    
    // Workstation 2 - Center
    { type: 'desk-wood', x: 5, y: 2, hasComputer: true, hasMonitor: true, hasKeyboard: true, hasMouse: true, hasPlant: false, hasLamp: true, hasCoffee: false, hasNotebook: false, hasPhone: true, hasBooks: false },
    { type: 'office-chair', x: 5, y: 3, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    
    // Workstation 3 - Right side
    { type: 'desk-wood', x: 8, y: 2, hasComputer: true, hasMonitor: true, hasKeyboard: true, hasMouse: true, hasPlant: true, hasLamp: false, hasCoffee: false, hasNotebook: true, hasPhone: false, hasBooks: true },
    { type: 'office-chair', x: 8, y: 3, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    
    // Kitchen Area
    { type: 'kitchen-counter', x: 12, y: 5, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'sink', x: 13, y: 5, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'refrigerator', x: 14, y: 5, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'coffee-machine', x: 12, y: 6, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'microwave', x: 13, y: 6, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    
    // Break Area
    { type: 'lounge-sofa', x: 15, y: 8, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'coffee-table', x: 16, y: 8, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'lounge-chair', x: 17, y: 8, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    
    // Decorative Elements
    { type: 'plant-large', x: 18, y: 10, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'window', x: 20, y: 12, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    
    // Additional Workstations
    { type: 'desk-wood', x: 11, y: 2, hasComputer: true, hasMonitor: true, hasKeyboard: true, hasMouse: true, hasPlant: false, hasLamp: true, hasCoffee: true, hasNotebook: false, hasPhone: true, hasBooks: false },
    { type: 'office-chair', x: 11, y: 3, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    
    // Meeting Table
    { type: 'conference-table', x: 6, y: 8, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'conference-chair', x: 5, y: 9, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'conference-chair', x: 7, y: 9, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    
    // Storage and Utilities
    { type: 'filing-cabinet', x: 19, y: 2, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'printer', x: 19, y: 4, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false },
    { type: 'water-cooler', x: 16, y: 5, hasComputer: false, hasMonitor: false, hasKeyboard: false, hasMouse: false, hasPlant: false, hasLamp: false, hasCoffee: false, hasNotebook: false, hasPhone: false, hasBooks: false }
  ]
};
