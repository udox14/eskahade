Get-ChildItem -Path 'app' -Filter '*.tsx' -Recurse | ForEach-Object {
    $first = (Get-Content $_.FullName -TotalCount 1)
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'useState|useEffect|useRef|useCallback|useMemo|useContext' -and $first -notmatch 'use client') {
        Write-Output $_.FullName
    }
}
