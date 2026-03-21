from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ReflectXR API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "reflectxr-api"}

# Uncomment as routers are built:
# from app.routers import auth, concepts, generate, chat, journal
# app.include_router(auth.router,     prefix="/auth",     tags=["auth"])
# app.include_router(concepts.router, prefix="/concepts", tags=["concepts"])
# app.include_router(generate.router, prefix="/generate", tags=["generate"])
# app.include_router(chat.router,     prefix="/chat",     tags=["chat"])
# app.include_router(journal.router,  prefix="/journal",  tags=["journal"])
