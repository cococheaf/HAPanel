# Security

**[Deutsch](SECURITY.md) · English**

Its server-side HA adapter has the permissions of the configured HA credential; the Supervisor proxy uses an administrator credential. Ingress access is restricted to active HA administrators. Outside Ingress, the editor is available only on loopback.

Use an HTTPS endpoint and matching `public_origin` for live wall displays. Do not expose the optional display port directly to the internet. Pairing is required even on the local network. A device session can execute the tile-bound actions in the published dashboard.

The public preview uses synthetic data and has no HA access. Dashboard exports can contain private entity names, but do not contain server-side tokens or device sessions.

Report security problems through GitHub’s **Report a vulnerability** feature in this repository. Do not include real tokens or private HA configurations in public issues.

Alarm commands and camera images require the existing administrator access through Ingress. Separately paired displays do not gain these permissions. Alarm codes are not stored; camera tokens and private stream URLs stay on the server.
