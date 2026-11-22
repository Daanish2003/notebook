# Notebook

A personal library of transcribed audio and video, transcribed on the owner's own machine and read from any of their devices.

## Language

**Source**:
One piece of media added to the Library: an uploaded audio/video file or a media URL.
_Avoid_: Recording, item, upload, video

**Library**:
The single collection of every Source. There is one per installation.
_Avoid_: Notebook (that is the app's name), workspace, collection

**Transcript**:
The text of one Source, made of ordered Segments. Each Source has exactly one.
_Avoid_: Transcription (that is the process), notes, text

**Segment**:
A contiguous stretch of speech in a Transcript with a start and end time, split where the speaker pauses.
_Avoid_: Line, chunk, caption, cue

**Transcription**:
The process that turns a Source's media into its Transcript, together with its state (queued, processing, done, failed).
_Avoid_: Job (when talking about the domain), task, conversion

**Export**:
The files written for a finished Transcript into a folder the owner chooses, so the text lives outside the app too.
_Avoid_: Backup, download, sync

**Owner**:
The one person whose machine runs Notebook and whose tailnet devices may reach it.
_Avoid_: User, account
