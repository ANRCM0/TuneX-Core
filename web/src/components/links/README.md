# Advanced connection resources

`/links` displays scoped, secret-free internal resource metadata. Forward Controller creates and reuses TST/1 connections from a single business request. All Forward creation, editing, suspension, resumption, retry, deletion, copying and diagnosis use `/forwards`.

The resource page does not expose key material, full deployment snapshots or business write APIs. Workspace and permission changes abort reads and remove the previous view.
