$ErrorActionPreference = 'Stop'

$base = 'http://127.0.0.1:9222'
$bookingId = 'ba23d8e3-2bfc-42ac-819e-93a541f6d935'
$token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwOi8vc2NoZW1hcy54bWxzb2FwLm9yZy93cy8yMDA1LzA1L2lkZW50aXR5L2NsYWltcy9uYW1laWRlbnRpZmllciI6IjBhN2U0YjZlLTRlMzUtNGJkMy04M2E4LWNmNGM1ZmJhNGI5OCIsImVtYWlsIjoicGF5bW9iLmUyZS5ndWVzdEBleGFtcGxlLmNvbSIsIkZ1bGxOYW1lIjoiUGF5bW9iIEUyRSBHdWVzdCIsIkF2YXRhclVybCI6IiIsImp0aSI6ImY5YTU4OTM2LTk0OWEtNDkwYy1iOGQyLTM0MmQzNTA5Yjg4YyIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6Ikd1ZXN0IiwiZXhwIjoxNzc2ODY2MDQxLCJpc3MiOiJSZW50YWxzUGxhdGZvcm1BcGkiLCJhdWQiOiJSZW50YWxzUGxhdGZvcm1DbGllbnRzIn0.wuBBNiboY3YKOmwz7rGTtv4iNOmp0Eyt_2tiSh8XRx4'

$target = Invoke-RestMethod -Uri "$base/json/new?http://localhost:4200/" -Method Put
$wsUrl = $target.webSocketDebuggerUrl

$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ws.ConnectAsync([Uri]$wsUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

$id = 0
function Send-Cdp {
  param(
    [string]$Method,
    [hashtable]$Params
  )

  $script:id++
  $payload = @{ id = $script:id; method = $Method; params = $Params } | ConvertTo-Json -Compress -Depth 20
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [ArraySegment[byte]]::new($bytes)

  $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()

  while ($true) {
    $buffer = New-Object byte[] 65536
    $inSegment = [ArraySegment[byte]]::new($buffer)
    $result = $ws.ReceiveAsync($inSegment, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $message = [Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)

    if ($message -match '"id"\s*:\s*' + $script:id) {
      return $message | ConvertFrom-Json
    }
  }
}

[void](Send-Cdp -Method 'Page.enable' -Params @{})
[void](Send-Cdp -Method 'Runtime.enable' -Params @{})
[void](Send-Cdp -Method 'Page.navigate' -Params @{ url = 'http://localhost:4200/' })

$waitHomeExpr = "(async()=>{if(document.readyState==='complete'){return {href:location.href,title:document.title};} await new Promise(r=>window.addEventListener('load',r,{once:true})); return {href:location.href,title:document.title};})()"
[void](Send-Cdp -Method 'Runtime.evaluate' -Params @{ expression = $waitHomeExpr; awaitPromise = $true; returnByValue = $true })

$seedExpr = "(()=>{localStorage.setItem('jwtToken','$token');sessionStorage.setItem('pendingPaymobBookingId','$bookingId');location.href='http://localhost:4200/checkout/callback?success=true&bookingId=$bookingId';return true;})()"
[void](Send-Cdp -Method 'Runtime.evaluate' -Params @{ expression = $seedExpr; awaitPromise = $false; returnByValue = $true })

$waitReceiptExpr = "(async()=>{await new Promise(r=>setTimeout(r,5000));return {href:location.href,title:document.title,text:(document.body&&document.body.innerText?document.body.innerText:'').slice(0,1200)};})()"
$response = Send-Cdp -Method 'Runtime.evaluate' -Params @{ expression = $waitReceiptExpr; awaitPromise = $true; returnByValue = $true }

$response | ConvertTo-Json -Depth 20
$value = $response.result.value
Write-Output ('FINAL_URL=' + $value.href)
Write-Output ('FINAL_TITLE=' + $value.title)
Write-Output ('BODY_SNIPPET=' + ($value.text -replace "`r?`n", ' | '))
$value | ConvertTo-Json -Depth 8
$ws.Dispose()
