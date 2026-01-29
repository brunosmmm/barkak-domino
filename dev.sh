#!/bin/bash
# Run both backend and frontend dev servers

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
KILL_EXISTING=false
for arg in "$@"; do
    case $arg in
        -k|--kill)
            KILL_EXISTING=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./dev.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -k, --kill    Kill existing instances before starting"
            echo "  -h, --help    Show this help message"
            exit 0
            ;;
    esac
done

# Kill existing instances if requested
if [ "$KILL_EXISTING" = true ]; then
    echo -e "${YELLOW}Killing existing instances...${NC}"
    pkill -f "uvicorn main:app" 2>/dev/null && echo "  Killed backend"
    pkill -f "vite.*frontend" 2>/dev/null && echo "  Killed frontend (vite)"
    # Also kill by port
    fuser -k 8000/tcp 2>/dev/null
    fuser -k 5173/tcp 2>/dev/null
    fuser -k 5174/tcp 2>/dev/null
    fuser -k 5175/tcp 2>/dev/null
    sleep 1
fi

echo -e "${GREEN}Starting development servers...${NC}"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}Done.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${GREEN}Starting backend (FastAPI)...${NC}"
cd "$SCRIPT_DIR/backend"
source venv/bin/activate 2>/dev/null || {
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
}
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
echo -e "${GREEN}Starting frontend (Vite)...${NC}"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo -e "\n${GREEN}Both servers running:${NC}"
echo -e "  Backend:  ${YELLOW}http://localhost:8000${NC}"
echo -e "  Frontend: ${YELLOW}http://localhost:5173${NC}"
echo -e "\nPress Ctrl+C to stop both servers\n"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
