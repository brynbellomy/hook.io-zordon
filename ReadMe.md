# hook.io-zordon is a WAN-capable auto-discovery hook for hooking up hooks with other hooks over the ENTIRE internet

Grab [hook.io-ranger]() and then try this on a remote shell (don't forget to change the IP/port!):
`zordon -l 123.45.67.8:1234 --rn ranger-zordon-listener -n my-remote-zordon --ldl 10`

And then on your local box, something like this (the -k argument should take the same IP/port as the -l argument above):
`zordon -k 123.45.67.8:1234 -n my-local-zordon --ldl 10`

Work in progress.