# Organising the Library

Type: grilling
Status: resolved
Blocked by:

## Question

How does the Owner organise Sources beyond search and the date timeline? Settle: tags, folders (each Source in exactly one), or both; manual only, or suggested (e.g. from the YouTube channel); where they appear in the Journal Library (filter chips under the search box?) and in the reader; how filters combine with search; whether Export Library can export one tag or folder; and what the GLOSSARY calls it.

## Answer

Decided with the Owner (grilling, 2026-11-22; recommendations accepted).

- **Tags, not folders.** A Source carries any number of Tags (e.g. `algorithms`, `work`). Tags are added and removed by hand only, with no auto-tagging; AI suggestions may come with "AI reading help".
- **Channel filter:** the YouTube channel or podcast name works as a built-in filter that needs no tagging.
- **Journal Library UI:** filter chips under the search box (Tags, then channels), and small Tag chips on each timeline entry. Tags are added and removed from the reader's top bar and from an entry's menu.
- **Combining:** selected chips narrow the Library, so a Source must have _all_ selected Tags (and match the selected channel). Search runs within the filtered set.
- **Export:** Export Library follows the active filter, so with a Tag selected it exports only those Sources.
- **Data:** a `tag` table and a `source_tag` join table, Recently deleted Sources excluded from filters. The table shape follows "Data model and media layout".
