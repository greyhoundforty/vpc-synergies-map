#!/usr/bin/env python3
"""
ibm_vpc_profiles_report.py

Bare-metal-only collector for the HTML availability report.

This is the scoped sibling of ibm_vpc_profiles.py: it does not list
virtual server instance profiles. Per VPC region it:

  1. Lists every bare metal profile offered there
     (`GET /v1/bare_metal_server/profiles`)
  2. Checks live capacity for that region
     (`GET /v1/bare_metal_server/capacities`)
  3. Joins the two into one row per (profile, zone) with
     `capacity_available` True/False

report.html auto-loads `data/current-bm-profiles.json`, which this
script refreshes on every successful run.

AUTH
----
Needs an IBM Cloud IAM API key in the environment variable named by
--api-key-env (default: IBMCLOUD_API_KEY):

    fnox run -- python ibm_vpc_profiles_report.py --output-dir ./data

USAGE
-----
    fnox run -- python ibm_vpc_profiles_report.py --output-dir ./data
    fnox run -- python ibm_vpc_profiles_report.py --regions us-south,eu-de
    fnox run -- python ibm_vpc_profiles_report.py --available-only
"""

import argparse
import os
import sys
from pathlib import Path

from ibm_vpc_profiles import run

BM_FILE_PREFIX = "ibm_vpc_bm_profiles"
BM_CURRENT_FILENAME = "current-bm-profiles.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(os.environ.get("OUTPUT_DIR", "./data")),
        help=(
            "Directory to write timestamped CSV/JSON output into. Defaults to "
            "OUTPUT_DIR if set, otherwise ./data."
        ),
    )
    parser.add_argument(
        "--api-key-env",
        type=str,
        default="IBMCLOUD_API_KEY",
        help="Name of the environment variable holding your IBM Cloud IAM API key.",
    )
    parser.add_argument(
        "--bootstrap-region",
        type=str,
        default="us-south",
        help="Region used only to call /v1/regions and discover every other region.",
    )
    parser.add_argument(
        "--regions",
        type=str,
        default="",
        help="Comma-separated list of region names to include (e.g. us-south,eu-de). Default: all regions.",
    )
    parser.add_argument(
        "--skip-bare-metal-capacity",
        action="store_true",
        help=(
            "List bare metal profiles, but skip the live /capacities check. "
            "capacity_available will be blank instead of True/False."
        ),
    )
    parser.add_argument(
        "--available-only",
        action="store_true",
        help="Drop profile+zone rows that do not currently have capacity.",
    )
    parser.add_argument(
        "--api-version",
        type=str,
        default=None,
        help="VPC API version date (YYYY-MM-DD) for the capacity REST call.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    regions_filter = set(r.strip() for r in args.regions.split(",") if r.strip()) or None
    run(
        args.output_dir,
        api_key_env=args.api_key_env,
        bootstrap_region=args.bootstrap_region,
        regions_filter=regions_filter,
        include_vsi=False,
        include_bare_metal=True,
        include_bare_metal_capacity=not args.skip_bare_metal_capacity,
        api_version=args.api_version,
        file_prefix=BM_FILE_PREFIX,
        current_filename=BM_CURRENT_FILENAME,
        available_only=args.available_only,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
