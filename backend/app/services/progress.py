"""Gerenciador de progresso via WebSocket para tarefas em background."""
import asyncio
import subprocess
import uuid
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket


@dataclass
class TaskInfo:
    """Informações de uma tarefa em execução."""
    task_id: str
    tipo: str
    total: int = 0
    atual: int = 0
    status: str = "iniciando"
    mensagem: str = ""
    concluida: bool = False
    cancelada: bool = False
    logs: list[dict[str, str]] = field(default_factory=list)


class ProgressManager:
    """Gerencia conexões WebSocket e broadcast de progresso."""

    def __init__(self) -> None:
        self._connections: list[WebSocket] = []
        self._tasks: dict[str, TaskInfo] = {}
        self._procs: dict[str, subprocess.Popen] = {}
        self._lock: asyncio.Lock | None = None  # inicializado lazy (precisa de event loop)

    def _get_lock(self) -> asyncio.Lock:
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._get_lock():
            self._connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._connections:
            self._connections.remove(ws)

    def create_task(self, tipo: str) -> str:
        task_id = uuid.uuid4().hex[:12]
        self._tasks[task_id] = TaskInfo(task_id=task_id, tipo=tipo)
        return task_id

    def get_task(self, task_id: str) -> TaskInfo | None:
        return self._tasks.get(task_id)

    def set_proc(self, task_id: str, proc: subprocess.Popen) -> None:
        self._procs[task_id] = proc

    def clear_proc(self, task_id: str) -> None:
        self._procs.pop(task_id, None)

    def cancel_task(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        if task and not task.concluida:
            task.cancelada = True
            proc = self._procs.pop(task_id, None)
            if proc and proc.poll() is None:
                proc.kill()
            return True
        return False

    def kill_all(self) -> None:
        for proc in list(self._procs.values()):
            try:
                if proc.poll() is None:
                    proc.kill()
            except Exception:
                pass
        self._procs.clear()
        for task in self._tasks.values():
            if not task.concluida:
                task.cancelada = True

    async def update_progress(
        self,
        task_id: str,
        atual: int,
        total: int,
        mensagem: str = "",
        status: str = "processando",
        elapsed: float | None = None,
        eta: float | None = None,
    ) -> None:
        task = self._tasks.get(task_id)
        if task:
            task.atual = atual
            task.total = total
            task.mensagem = mensagem
            task.status = status

        await self._broadcast({
            "type": "progress",
            "task_id": task_id,
            "atual": atual,
            "total": total,
            "mensagem": mensagem,
            "status": status,
            "elapsed": elapsed,
            "eta": eta,
        })

    async def add_log(
        self, task_id: str, mensagem: str, nivel: str = "info"
    ) -> None:
        task = self._tasks.get(task_id)
        if task:
            task.logs.append({"mensagem": mensagem, "nivel": nivel})

        await self._broadcast({
            "type": "log",
            "task_id": task_id,
            "mensagem": mensagem,
            "nivel": nivel,
        })

    async def complete_task(self, task_id: str, mensagem: str = "") -> None:
        task = self._tasks.get(task_id)
        if task:
            task.concluida = True
            task.status = "concluido"
            task.mensagem = mensagem

        await self._broadcast({
            "type": "complete",
            "task_id": task_id,
            "mensagem": mensagem,
        })

    async def _broadcast(self, data: dict[str, Any]) -> None:
        async with self._get_lock():
            snapshot = list(self._connections)  # cópia para evitar mutação durante iteração

        dead: list[WebSocket] = []
        for ws in snapshot:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)

        if dead:
            async with self._get_lock():
                for ws in dead:
                    self.disconnect(ws)


# Instância global (singleton)
progress_manager = ProgressManager()
