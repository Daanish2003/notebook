#!/bin/bash
# usage: fetch_sherpa_models.sh DIR
set -e
cd "$1"
R=https://github.com/k2-fsa/sherpa-onnx/releases/download
curl -sL -O $R/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2
tar xjf sherpa-onnx-pyannote-segmentation-3-0.tar.bz2
curl -sL -O $R/speaker-segmentation-models/sherpa-onnx-reverb-diarization-v1.tar.bz2
tar xjf sherpa-onnx-reverb-diarization-v1.tar.bz2
for e in 3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx nemo_en_titanet_large.onnx nemo_en_titanet_small.onnx wespeaker_en_voxceleb_resnet34_LM.onnx 3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx; do
  curl -sL -O $R/speaker-recongition-models/$e
done
ls -la . sherpa-onnx-pyannote-segmentation-3-0 sherpa-onnx-reverb-diarization-v1
