# Virtual Office - Gather Clone

A virtual office application similar to Gather, featuring movable characters, real-time communication, and multiple office environments.

## Features

- 🏢 **Multiple Office Rooms**: Main Office, Meeting Room, and Break Room
- 👥 **Movable Characters**: Use WASD or arrow keys to navigate
- 💬 **Real-time Chat**: Communicate with other users in the same room
- 🎨 **Customizable Avatars**: Choose from various emoji avatars
- 🌐 **Real-time Updates**: See other users move and chat in real-time
- 📱 **Responsive Design**: Modern UI with smooth animations

## Tech Stack

- **Frontend**: React 18, Vite
- **Backend**: Node.js, Express
- **Real-time**: Socket.IO
- **Styling**: CSS3 with modern design principles

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd work-together
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the backend server**
   ```bash
   npm start
   ```
   This will start the server on port 5000

4. **Start the frontend development server**
   ```bash
   npm run dev
   ```
   This will start the frontend on port 3000

## Usage

### Getting Started

1. Open your browser and navigate to `http://localhost:3000`
2. Enter your name and choose an avatar
3. Click "Enter Office" to join the virtual office

### Controls

- **Movement**: Use WASD keys or Arrow keys to move your character
- **Room Switching**: Use the room selector in the left control panel
- **Chat**: Type messages in the chat panel on the right
- **Toggle Controls**: Click the gear button (⚙) to show/hide the control panel

### Office Layouts

- **Main Office**: Open workspace with individual desks and chairs
- **Meeting Room**: Conference table setup for team meetings
- **Break Room**: Relaxation area with coffee machines and seating

## Project Structure

```
work-together/
├── src/
│   ├── components/
│   │   ├── OfficeGrid.jsx      # Office layout rendering
│   │   ├── Character.jsx       # Movable character component
│   │   ├── Controls.jsx        # User input controls
│   │   ├── ChatPanel.jsx       # Real-time chat interface
│   │   └── RoomInfo.jsx        # Room information display
│   ├── data/
│   │   └── officeData.js       # Office layouts and objects
│   ├── App.jsx                 # Main application component
│   ├── main.jsx                # React entry point
│   └── index.css               # Global styles
├── server.js                   # Express + Socket.IO server
├── package.json                # Dependencies and scripts
└── vite.config.js             # Vite configuration
```

## Development

### Adding New Rooms

1. Add room layout to `src/data/officeData.js`
2. Define the grid layout and office objects
3. Update the room selector in `Controls.jsx`

### Customizing Characters

- Modify avatar options in `Controls.jsx`
- Update character colors in `Character.jsx`
- Add new character features as needed

### Styling

- Main styles are in `src/index.css`
- Component-specific styles can be added inline or in separate CSS files
- Uses CSS Grid for the office layout

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy Backend

1. Set environment variables for production
2. Deploy `server.js` to your hosting platform
3. Update the Socket.IO connection URL in the frontend

### Deploy Frontend

1. Build the project: `npm run build`
2. Deploy the `dist` folder to your hosting platform
3. Ensure the backend URL is correctly configured

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues or questions, please open an issue in the repository or contact the development team.

---

**Enjoy your virtual office experience! 🏢✨**