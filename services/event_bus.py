"""
services/event_bus.py

Basit bir in-memory pub/sub (yayın/abone) mekanizması.
scan(), _gather_leaks_for_asset() ve zamanlanmış taramaların ürettiği olayları
SSE ile bağlı istemcilere anlık olarak iletir.

NOT: Tek process/tek worker varsayımıyla çalışır. Birden fazla uvicorn worker'ı
ile çalıştırılacaksa (--workers > 1) bu mekanizma yerine Redis pub/sub gerekir.
"""

import asyncio
import json
import time
from typing import Any, AsyncGenerator, Dict, List


class LiveFeedBus:
    def __init__(self, max_history: int = 200) -> None:
        self._subscribers: List[asyncio.Queue] = []
        self._history: List[Dict[str, Any]] = []
        self._max_history = max_history
        self._lock = asyncio.Lock()

    async def publish(self, event_type: str, message: str, **extra: Any) -> None:
        event = {"type": event_type, "message": message, "timestamp": time.time(), **extra}

        async with self._lock:
            self._history.append(event)
            if len(self._history) > self._max_history:
                self._history.pop(0)
            subscribers = list(self._subscribers)

        for queue in subscribers:
            # Kuyruk doluysa en eski olayı at, yavaş istemci diğerlerini bloklamasın.
            if queue.full():
                try:
                    queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
            await queue.put(event)

    async def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._subscribers.append(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue) -> None:
        async with self._lock:
            if queue in self._subscribers:
                self._subscribers.remove(queue)

    def get_history(self) -> List[Dict[str, Any]]:
        return list(self._history)


live_feed_bus = LiveFeedBus()


async def event_stream(request) -> AsyncGenerator[str, None]:
    """SSE formatında olay üretici. İstemci bağlantıyı kapatınca kuyruğu temizler."""
    queue = await live_feed_bus.subscribe()
    try:
        # Yeni bağlanan istemciye son birkaç olayı geçmiş olarak gönder.
        for event in live_feed_bus.get_history()[-20:]:
            yield f"event: leak-feed\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"

        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield f"event: leak-feed\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"  # bağlantıyı canlı tutmak için yorum satırı
    finally:
        await live_feed_bus.unsubscribe(queue)