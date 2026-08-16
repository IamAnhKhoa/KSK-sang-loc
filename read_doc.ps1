$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open('c:\Users\Administrator\Desktop\KSK sang loc\BIUMUG~1.DOC')
$text = $doc.Range().Text
[System.IO.File]::WriteAllText('c:\Users\Administrator\Desktop\KSK sang loc\doc_content.txt', $text, [System.Text.Encoding]::UTF8)
$doc.Close()
$word.Quit()
Write-Output "EXTRACTED_SUCCESS"
