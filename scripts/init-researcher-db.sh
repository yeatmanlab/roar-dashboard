#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE roar_core;
    CREATE DATABASE roar_assessment;
EOSQL
