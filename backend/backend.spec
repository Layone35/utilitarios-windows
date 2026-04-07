# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec para empacotar o backend FastAPI como sidecar Tauri

block_cipher = None

a = Analysis(
    ["server.py"],
    pathex=["."],
    binaries=[],
    datas=[
        ("app", "app"),  # inclui todo o pacote app/ (routers, services, models)
    ],
    hiddenimports=[
        # uvicorn internals
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "uvicorn.lifespan.off",
        # módulos do projeto
        "app.routers.video",
        "app.routers.audio",
        "app.routers.folders",
        "app.routers.compress",
        "app.routers.utils",
        "app.routers.pdf",
        "app.routers.organize",
        "app.services.progress",
        "app.models.schemas",
        # dependências diversas
        "anyio",
        "anyio.abc",
        "anyio._backends._asyncio",
        "h11",
        "websockets",
        "websockets.asyncio",
        "websockets.asyncio.server",
        "websockets.asyncio.client",
        "websockets.asyncio.connection",
        "websockets.connection",
        "websockets.exceptions",
        "websockets.frames",
        "websockets.http11",
        "websockets.streams",
        "websockets.typing",
        "websockets.uri",
        "websockets.version",
        "starlette.middleware.cors",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # sem janela de console
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
