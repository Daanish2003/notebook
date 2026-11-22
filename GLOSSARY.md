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

**Tag**:
A label the Owner puts on Sources to group them. A Source can carry any number of Tags.
_Avoid_: Folder, category, label, collection

**Transcription**:
The process that turns a Source's media into its Transcript, together with its state (queued, processing, done, failed).
_Avoid_: Job (when talking about the domain), task, conversion

**Export**:
A Transcript turned into files and downloaded to the device that asked for it. It is the only way Library data reaches a device.
_Avoid_: Backup, sync, offline copy

**Recently deleted**:
Where a removed Source waits for 30 days before it is gone for good. It is invisible to the Library, search, and Export.
_Avoid_: Trash, bin, archive

**AI notes**:
Machine-written notes about one Transcript (a summary, key points, and chapters when the Source has none), made on request and always labelled as generated.
_Avoid_: Summary (that is one part), insights, analysis

**Agent token**:
A named, revocable secret one agent client (such as Claude Code or the Bot SDK) presents to use Notebook's agent tools.
_Avoid_: API key, password, access key

**Owner**:
The one person whose machine runs Notebook and whose tailnet devices may reach it.
_Avoid_: User, account
