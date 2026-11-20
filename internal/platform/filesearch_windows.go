package platform

import (
	"context"
	"errors"
	"os"
	"strings"
)

// SearchFiles queries the Windows Search index for file names in the user
// profile. The query travels in an environment variable, never in the script.
func SearchFiles(ctx context.Context, query string) ([]string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	raw, err := powershellContext(ctx, `$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.UTF8Encoding]::new();$q=$env:QD_QUERY -replace "['%_\[\]]",'';$scope=$env:QD_SCOPE -replace "'","''";$c=New-Object -ComObject ADODB.Connection;$r=New-Object -ComObject ADODB.Recordset;$c.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';");$r.Open("SELECT TOP 2000 System.ItemPathDisplay FROM SYSTEMINDEX WHERE System.FileName LIKE '%"+$q+"%' AND SCOPE='file:"+$scope+"'",$c);while(-not $r.EOF){$r.Fields.Item('System.ItemPathDisplay').Value;$r.MoveNext()};$r.Close();$c.Close()`, "QD_QUERY="+query, "QD_SCOPE="+home)
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	if err != nil {
		return nil, errors.New("Windows 搜索索引不可用，请确认 Windows Search 服务已开启")
	}
	keep, lines := homeFiles(home), []string{}
	for _, line := range strings.Split(strings.ReplaceAll(string(raw), "\r\n", "\n"), "\n") {
		if keep(line) {
			lines = append(lines, line)
		}
	}
	return lines, nil
}
func OpenPath(path string) error {
	if _, err := os.Stat(path); err != nil {
		return errors.New("文件已移动或删除")
	}
	return shellOpen(path)
}
