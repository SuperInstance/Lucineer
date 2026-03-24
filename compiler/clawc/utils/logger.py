"""clawc.utils.logger — Structured logging for the compiler pipeline."""

import logging
import os
import sys

_LOG_LEVEL = os.environ.get("CLAWC_LOG", "INFO").upper()
_FMT = "[%(levelname)-8s %(name)s] %(message)s"

logging.basicConfig(stream=sys.stderr, format=_FMT,
                    level=getattr(logging, _LOG_LEVEL, logging.INFO))


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"clawc.{name}")
