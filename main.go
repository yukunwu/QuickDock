package main

import (
	"embed"
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"log"
	"os"
	"path/filepath"
	"quickdock/internal/i18n"
	"quickdock/internal/platform"
	"strings"
	"sync"
)

//go:embed build/tray.png
var trayIcon []byte

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	dir, err := os.UserConfigDir()
	if err != nil {
		log.Fatal(err)
	}
	service := newService(filepath.Join(dir, "QuickDock"))
	app := application.New(application.Options{Name: "QuickDock", Description: "随唤随用的本地快捷工具", ShouldQuit: service.prepareToolQuit, Services: []application.Service{application.NewService(service)}, Assets: application.AssetOptions{Handler: application.BundledAssetFileServer(assets)}, Mac: application.MacOptions{ActivationPolicy: application.ActivationPolicyAccessory}, SingleInstance: &application.SingleInstanceOptions{UniqueID: "com.quickdock.desktop", OnSecondInstanceLaunch: func(data application.SecondInstanceData) {
		if service.window != nil {
			for _, arg := range data.Args {
				if arg == "--toggle" {
					service.toggle()
					return
				}
			}
			service.show()
		}
	}}, ErrorHandler: func(err error) {
		log.Print(err)
		if strings.Contains(err.Error(), "global shortcut") {
			service.mu.Lock()
			service.shortcutError = err.Error()
			service.mu.Unlock()
		}
	}})
	service.app = app
	service.initUpdates()
	service.shortcuts = app.GlobalShortcut
	service.window = app.Window.NewWithOptions(application.WebviewWindowOptions{Title: "QuickDock", Name: "quickdock", Width: 780, Height: 340, MinWidth: 700, MinHeight: 300, URL: "/", Frameless: true, InitialPosition: application.WindowCentered, Mac: application.MacWindow{Backdrop: application.MacBackdropTransparent, CollectionBehavior: application.MacWindowCollectionBehaviorCanJoinAllSpaces | application.MacWindowCollectionBehaviorFullScreenAuxiliary}})
	service.window.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) { service.Hide(); e.Cancel() })
	service.window.OnWindowEvent(events.Common.WindowLostFocus, func(_ *application.WindowEvent) {
		service.mu.Lock()
		editing := service.editing
		service.mu.Unlock()
		if !editing {
			service.Hide()
		}
	})
	app.Event.OnApplicationEvent(events.Mac.ApplicationShouldHandleReopen, func(_ *application.ApplicationEvent) { service.show() })
	var firstRuntime sync.Once
	service.window.OnWindowEvent(events.Common.WindowRuntimeReady, func(_ *application.WindowEvent) {
		log.Print("window runtime ready")
		// Internal idle reclamation reloads the page without revealing the window.
		firstRuntime.Do(func() {
			application.InvokeSync(func() { platform.ConfigureMaterial(service.window.NativeWindow()) })
			service.show()
		})
	})
	tray := app.SystemTray.New()
	tray.SetIcon(trayIcon)
	menu := app.NewMenu()
	service.localizedMenu = map[string]*application.MenuItem{}
	addMenu := func(key string) *application.MenuItem {
		item := menu.Add(i18n.T(service.locale(), key))
		service.localizedMenu[key] = item
		return item
	}
	addMenu("打开 QuickDock").OnClick(func(_ *application.Context) { service.show() })
	addMenu("打开翻译窗口").OnClick(func(_ *application.Context) {
		if err := service.OpenToolWindow("translate", ""); err != nil {
			log.Print(err)
		}
	})
	addMenu("检查更新").OnClick(func(_ *application.Context) {
		service.show()
		service.window.ExecJS(`window.dispatchEvent(new Event("quickdock-open-settings"))`)
		go service.CheckForUpdates()
	})
	addMenu("刷新应用索引").OnClick(func(_ *application.Context) { service.RefreshApps() })
	menu.AddSeparator()
	addMenu("退出 QuickDock").OnClick(func(_ *application.Context) { app.Quit() })
	tray.SetMenu(menu)
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(_ *application.ApplicationEvent) {
		go func() {
			service.restoreToolWindows()
			log.Print("application started; registering shortcut")
			if err := app.GlobalShortcut.Register(service.Snapshot().Settings.Shortcut, service.toggle); err != nil {
				service.mu.Lock()
				service.shortcutError = err.Error()
				service.mu.Unlock()
			}
			log.Printf("shortcuts: %v", app.GlobalShortcut.GetAll())
			service.RefreshApps()
		}()
	})
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
