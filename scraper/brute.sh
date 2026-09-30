#!/bin/bash
# Comprueba en paralelo qué subdominios de calicotab existen (200 en /api/v1/tournaments)
cat "$1" | xargs -P 20 -I{} sh -c 'code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 "https://{}/api/v1/tournaments"); [ "$code" = "200" ] && echo "{}"' 
