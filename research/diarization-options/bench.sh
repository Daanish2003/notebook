#!/bin/bash
# Serial CPU-vs-GPU benchmark of every option; one job at a time so timings are clean.
# Envs: ASR = the onnx-asr uv project (onnxruntime-gpu 1.32), T = torch 2.15 + transformers 5.24 + NeMo 3.0,
#       SG = sherpa-onnx 2.0.2+cuda12.cudnn9 with pip CUDA 12 runtime libs.
W=${DIAR_WORK:?set DIAR_WORK to a scratch dir with ref/, out/, MODELDIR and work/ (these scripts)}
M=$(cat $W/MODELDIR); A=${DIAR_AUDIO:?dir with clip.wav ep209.wav ep283.wav (16 kHz mono)}; O=$W/out/bench; mkdir -p $O; cd $W/work
ASR=${ASR_PY:?python of the onnx-asr uv project}
T=${TORCH_PY:?python of a torch+transformers+nemo venv}
SG=${SHERPA_GPU_VENV:?venv with sherpa-onnx CUDA build}
NV=$SG/lib/python3.13/site-packages/nvidia
SGLIB=$(ls -d $NV/*/lib | tr '\n' ':')
run() { echo "== $*" >> $O/stderr.log; "$@" 2>>$O/stderr.log | grep '^{' >> $O/bench.jsonl; tail -1 $O/bench.jsonl | cut -c1-300; }
for e in ${FILES:-ep209 ep283}; do
  run $ASR nemotron_onnx.py $M/nemotron-onnx $A/$e.wav $O/$e.nemo-onnx.cuda.json cuda step.onnx
  run $ASR nemotron_onnx.py $M/nemotron-onnx $A/$e.wav $O/$e.nemo-onnx-int8.cuda.json cuda step_int8.onnx
  HF_HOME=$M/hf run $T run_nemotron_hf.py $A/$e.wav $O/$e.nemo-hf.cuda.json cuda fp32
  HF_HOME=$M/hf run $T run_sortformer_nemo.py $A/$e.wav $O/$e.sortformer.cuda.json cuda
  for emb in 3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx nemo_en_titanet_small.onnx; do
    LD_LIBRARY_PATH=$SGLIB run $SG/bin/python run_sherpa.py $M $A/$e.wav $O/$e.sherpa.${emb%%.onnx}.cuda.json $emb 0.9 6 cuda
  done
done
e=ep209
run $ASR nemotron_onnx.py $M/nemotron-onnx $A/$e.wav $O/$e.nemo-onnx.cpu.json cpu step.onnx
run $ASR nemotron_onnx.py $M/nemotron-onnx $A/$e.wav $O/$e.nemo-onnx-int8.cpu.json cpu step_int8.onnx
HF_HOME=$M/hf run $T run_nemotron_hf.py $A/$e.wav $O/$e.nemo-hf.cpu.json cpu fp32
HF_HOME=$M/hf run $T run_sortformer_nemo.py $A/$e.wav $O/$e.sortformer.cpu.json cpu
echo BENCH-DONE
