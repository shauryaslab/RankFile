# Chessable — Chess Square Speed Drill

Chessable is a speed-drill web application designed to help chess players improve their board vision and square recognition. Players race against the clock to click the correct square on a board or identify square colors, building fluency in square memorization.

## Features

*   **Square Drill Mode**: A square name (e.g., "e5") appears, and the player must quickly click the corresponding square on the chessboard.
*   **Color Drill Mode**: A square name appears, and the player must correctly identify whether it is a light or dark square.
*   **Difficulty Tiers** (Square Drill):
    *   **Easy**: Coordinates are shown on the edges of the board.
    *   **Normal**: Coordinates are hidden.
    *   **Hard**: Coordinates are hidden, and the board perspective randomly flips between White and Black to increase difficulty.
*   **Time Options**: Choose between 30s, 60s, or 120s drills.
*   **Stats & Heatmap**: At the end of a drill, view your score, accuracy, average reaction time, and a heatmap showing which squares you are fastest and slowest at finding.
*   **Personal Bests**: Your high scores are saved locally in your browser for each mode, difficulty, and time combination.
*   **Weighted Randomization**: After the first round, the app intelligently biases prompts toward squares you have missed or are slower at finding, ensuring you practice your weak spots.
*   **Responsive Design**: Playable on desktop, tablet, and mobile devices.

## Technologies Used

This project is built using pure vanilla web technologies with no external dependencies or build tools:
*   HTML5
*   CSS3 (Custom properties, CSS Grid, Flexbox, Animations)
*   JavaScript (ES6+)

## How to Run

Since there are no build steps, you can run this project simply by opening the `index.html` file in any modern web browser.

1.  Clone the repository or download the source code.
2.  Open the `index.html` file in your preferred browser:
    ```bash
    # Linux
    xdg-open index.html
    
    # macOS
    open index.html
    
    # Windows
    start index.html
    ```

Alternatively, you can serve it using a simple local web server:
```bash
python3 -m http.server 8000
# Then open http://localhost:8000 in your browser
```

## Project Structure

```text
chessable/
├── index.html      # Main HTML file containing the app structure
├── css/
│   └── style.css   # Styling, layout, and animations
└── js/
    └── app.js      # Game logic, state management, and UI updates
```
