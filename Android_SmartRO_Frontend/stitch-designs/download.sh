#!/bin/bash
# Download all 12 Stitch screen HTMLs in parallel
set -e
cd "$(dirname "$0")"

declare -a names=(
  "01_Login"
  "02_VerifyOTP"
  "03_Home"
  "04_Catalog"
  "05_ProductDetail"
  "06_BookingFlow"
  "07_BookingKYC"
  "08_MyPlan"
  "09_Tickets"
  "10_NewTicket"
  "11_TicketDetail"
  "12_Profile"
)

declare -a urls=(
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzU1YWU2ZmQxNzljZTRlYjVhNjA5ODMzODM1OTM5NDE5EgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzc2NTAwMDNmNDI4ODQxYTZhY2M1YjQyMzU4YzJlNDNiEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2Q5YzA2ZTM4Y2ZjNjQ5NjBiY2MyMWVhYjFlNDExZTBiEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzJkNTQwY2U0M2M0MjQ1MTU5YjEyNTdkNzlkY2IyNzRjEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzc2NWZiMjk4MWVlYjQ1ZmNiMTNhYzllNmZmYjAzNjAyEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAyY2U0YzFjOTkzOTQyYTBiZTA2MWMwNzQ4NjhhNTZhEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2UwOTlkZWRjNjBjNDQ3OGVhNjA1OGY1ZmRiNzBlNzAzEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzRjYWUzYzlmMmE3NDQ1OGE4MjkxYjlmMjBmNzdhNjRlEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzM5Yzg1N2YxYmQ5MTQ5YWRiNzk5ZGE5YmFlNTY4N2E4EgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzA5NTM4ZWJhZjAzNzQ0NzhiZWI4ZTE2NjgyZDYxY2ViEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzk4MGZkYWNmZWYyYTQ3NGRiODgxOWY0ZDZmYjZiMzUxEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
  "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzhiNTRjYTg2NWQ2OTQ0ZWNhNGM1OTU4N2RjYjY2NjhjEgsSBxDG78mozAwYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzc0NTg0MDI1MTMxMDEzOTU2Mw&filename=&opi=89354086"
)

for i in "${!names[@]}"; do
  curl -sL "${urls[$i]}" -o "${names[$i]}.html" &
done
wait
ls -la *.html | awk '{printf "%-25s %8s bytes\n", $NF, $5}'
