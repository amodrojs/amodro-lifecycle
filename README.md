# amodro-lifecycle

JS module loader lifecycle engine. Used to drive specific module system loaders

Not ready for use yet.


Paths fallback: done in fetch() implementation.

If wanting to load general transpiler based on file extension, do that in fetch.

lifecycle.registry needs to get an entry for the module either in:
* fetch
* translate
* evaluation of the translated source.
