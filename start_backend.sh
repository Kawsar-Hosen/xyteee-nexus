#!/bin/bash
export PATH="$HOME/workspace/.pythonlibs/bin:$PATH"
cd backend
exec uvicorn server:app --host 0.0.0.0 --port 8000 --reload
