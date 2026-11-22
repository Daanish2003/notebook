"""Peak VRAM (per process, via nvidia-smi) and peak RSS for a benchmark run.

The sampler runs in a separate process: native calls that hold the GIL for the
whole run (sherpa-onnx's process()) would starve a sampler thread."""
import multiprocessing as mp
import os, resource, subprocess, time


def _sample(pid: int, peak, stop, interval: float):
    while not stop.is_set():
        try:
            out = subprocess.run(["nvidia-smi", "--query-compute-apps=pid,used_memory",
                                  "--format=csv,noheader,nounits"],
                                 capture_output=True, text=True, timeout=5).stdout
            for line in out.splitlines():
                p, mib = [x.strip() for x in line.split(",")]
                if int(p) == pid:
                    peak.value = max(peak.value, int(mib))
        except Exception:
            pass
        stop.wait(interval)


class Meter:
    def __init__(self, interval=0.2):
        ctx = mp.get_context("fork")  # spawn would re-run the calling script
        self._peak, self._stop = ctx.Value("i", 0), ctx.Event()
        self._p = ctx.Process(target=_sample, args=(os.getpid(), self._peak, self._stop, interval), daemon=True)

    @property
    def peak_mib(self):
        return self._peak.value

    def __enter__(self):
        self._p.start()
        return self

    def __exit__(self, *a):
        self._stop.set()
        self._p.join()

    @staticmethod
    def rss_mib():
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss // 1024
