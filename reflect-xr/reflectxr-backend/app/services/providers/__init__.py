"""
providers/ — image-generation provider adapters.

Each module exposes a single coroutine `generate_image(prompt: str) -> dict`
that returns `{ "image_bytes": bytes, "revised_prompt": str }`. The shape is
intentionally identical across providers so `image_service._generate_one_image`
can race them without branching on provider-specific result shapes.

Failures raise `ProviderError` (defined below). The caller catches it and
either tries the next provider in the race or escalates to the async
retry worker.
"""


class ProviderError(RuntimeError):
    """
    Raised by a provider when generation fails for any reason — HTTP error,
    timeout, content-policy block, empty response, etc.

    The `provider` attribute records which provider raised so logs can
    distinguish "OpenAI failed → fell back to Gemini" from "Gemini also
    failed → escalated to async retry."
    """

    def __init__(self, provider: str, message: str):
        super().__init__(f"[{provider}] {message}")
        self.provider = provider
        self.message = message


class AllProvidersFailed(RuntimeError):
    """
    Raised by `image_service._generate_one_image` when every provider in
    the race has failed. Carries the individual per-provider errors so
    callers (the /generate router, the async retry worker) can log what
    went wrong at each hop.

    The router catches this specifically and escalates to the async
    retry worker instead of returning a 500.
    """

    def __init__(self, errors: list[ProviderError]):
        self.errors = errors
        super().__init__(
            "all providers failed: "
            + "; ".join(f"{e.provider}={e.message}" for e in errors)
        )
