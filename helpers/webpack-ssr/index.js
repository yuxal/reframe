const assert_internal = require('reassert/internal');
const assert_usage = require('reassert/usage');
const log = require('reassert/log');
const {IsoBuilder} = require('@rebuild/iso');
const {Logger} = require('@rebuild/build/utils/Logger');
//const dir = require('node-dir');
const path_module = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const forceRequire = require('./utils/forceRequire');

const get_parent_dirname = require('@brillout/get-parent-dirname'); // TODO remove from package.json
const mime = require('mime'); // TODO remove from package.json

module.exports = WebpackSSR;

function WebpackSSR(opts) {
    Object.assign(this, opts);
    this.build = build.bind(this);
}

// TODO rename source-code
const GENERATED_DIR = 'generated'+path_module.sep;
const BROWSER_DIST_DIR = 'browser'+path_module.sep;

function build({
    onBuild,
    log: log_option,
}={}) {
    const isoBuilder = new IsoBuilder();

    isoBuilder.logger = Logger({log_config_and_stats: log_option});
    assert_usage(this.outputDir);
    isoBuilder.outputDir = this.outputDir;
    isoBuilder.webpackBrowserConfigModifier = this.webpackBrowserConfig;
    isoBuilder.webpackServerConfigModifier = this.webpackNodejsConfig;

    isoBuilder.builder = async there_is_a_newer_run => {
        const {fileWriter} = isoBuilder;

     // const page_objects = get_pages({pagesDirPath});

        this.pageFiles = getPageFiles.call(this);

        this.pageNames = Object.keys(this.pageFiles);

        const server_entries = getServerEntries.call(this);

        await isoBuilder.build_server(server_entries);
        if( there_is_a_newer_run() ) return;

        const {buildState} = isoBuilder;

        this.pageModules = loadPageModules.call(this, buildState.server.output.entry_points);

        this.pageInfos = getPageInfos.call(this);

        /*
        enhance_page_objects_1({page_objects, buildState, fileWriter, reframeConfig});
        */

        const pageBrowserEntries = generatePageBrowserEntries.call(this, {fileWriter});

     // const browser_entries = get_browser_entries({page_objects, fileWriter});

        await isoBuilder.build_browser(pageBrowserEntries);
        if( there_is_a_newer_run() ) return;

        writeAssetMap.call(this, {buildState, fileWriter});

        await writeHtmlFiles.call(this, {fileWriter});
        if( there_is_a_newer_run() ) return;

        if( onBuild ) {
            onBuild();
        }
    };

    if( this.watchDir && ! is_production() ) {
        on_page_file_removal_or_addition(
            this.watchDir,
            () => isoBuilder.build()
        );
    }

    return isoBuilder.build();
}

function on_page_file_removal_or_addition(path, listener) {
    const watcher = chokidar.watch(path, {ignoreInitial: true});
    watcher.on('add', (p) => {
        listener();
    });
    watcher.on('unlink', () => {
        listener();
    });
}

function get_pages({pagesDirPath}) {
    const page_objects = {};

    if( ! pagesDirPath ) {
        return page_objects;
    }

    get_page_files({pagesDirPath})
    .forEach(({file_path, file_name, page_name, entry_name, is_dom, is_entry, is_base}) => {
        const page_object = page_objects[page_name] = page_objects[page_name] || {page_name};
        if( is_base ) {
            assert_usage(!page_object.server_entry, page_object, page_object.server_entry, file_path);
            page_object.page_config__source_path = file_path;
            page_object.server_entry = {
                entry_name,
                source_path: file_path,
            };
        }
        if( is_dom ) {
            assert_usage(!page_object.browser_entry);
            assert_usage(!page_object.browser_page_config__source);
            page_object.browser_page_config__source = file_path;
        }
        if( is_entry ) {
            assert_usage(!page_object.browser_entry);
            assert_usage(!page_object.browser_page_config__source);
            page_object.browser_entry__source_path = file_path;
            page_object.browser_entry = {
                entry_name,
                source_path: file_path,
            };
        }
    });

    /*
    Object.values(page_objects)
    .forEach(page_object => {
        assert_usage(page_object.page_config__source_path);
        assert_internal(path_module.isAbsolute(page_object.server_entry.file_path));
    });
    */

    assert_usage(
        Object.values(page_objects).filter(page_objects => page_objects.page_config__source_path).length>0,
        "No page config found at `"+pagesDirPath+"`."
    );

    return page_objects;
}

function getPageInfos() {
    const {pageModules} = this;
    assert_internal(pageModules);
    const pageInfos__array = this.getPageInfos(pageModules);
    const pageInfos = {};
    pageInfos__array.forEach(pageInfo => {
        const {pageName, browserEntryString, browserEntryOnlyCss} = pageInfo;
        assert_usage(pageName);
        assert_usage(browserEntryString);
        pageInfos[pageName] = {
            pageName,
            browserEntryString,
            browserEntryOnlyCss: !!browserEntryOnlyCss,
        };
    });
    return pageInfos;
}

function getPageFiles() {
    const pageFiles = {};
    const filePaths = this.getPageFiles();
    assert_usage(filePaths instanceof Array);
    filePaths
    .forEach(filePath => {
        assert_usage(
            filePath && filePath.constructor===String && path_module.isAbsolute(filePath),
            filePath
        );
        const fileName = path_module.basename(filePath);
        const pageName = fileName.split('.')[0];
        assert_usage(
            !pageFiles[pageName],
            pageName
        );
        pageFiles[pageName] = filePath;
    });
    return pageFiles;
}

function getServerEntries() {
    const {serverEntryFile} = this;

    const server_entries = {};

    if( serverEntryFile ) {
        assert_usage(path_module.isAbsolute(serverEntryFile));
        server_entries.server = [serverEntryFile];
    }

    const {pageFiles} = this;
    Object.entries(pageFiles)
    .forEach(([pageName, pageFile]) => {
        assert_internal(!server_entries[pageName]);
        server_entries[pageName] = [pageFile];
    });

    /*
    const pageFiles = getPageFiles();
    assert_usage(pageFiles instanceof Object);

    Object.values(pageFiles)
    .forEach(pageInfo => {
        assert_usage(pageInfo);
        const {name, pageFile} = pageInfo;
        assert_usage(name!=='server');
        assert_usage(pageFile);
        assert_usage(path_module.isAbsolute(pageFile), pageFile);
        assert_internal(!server_entries[name]);
        server_entries[name] = [pageFile];
    });
    */

    return server_entries;
}

function get_browser_entries__browser_entry({page_objects, browser_entries, already_added}) {
    Object.values(page_objects)
    .filter(page_object => page_object.browser_entry)
    .forEach(page_object => {
        const {entry_name, source_path} = page_object.browser_entry;
        assert_internal(entry_name);
        assert_internal(source_path);
        already_added[source_path] = true;
        assert_internal(!browser_entries[entry_name], entry_name);
        browser_entries[entry_name] = [source_path];
    });
}

function get_browser_entries({page_objects, /*fileWriter,*/}) {

    const browser_entries = {};
    const already_added = {};

    get_browser_entries__browser_entry({page_objects, browser_entries, already_added});

    assert_internal(Object.values(browser_entries).length>0);

    return browser_entries;
}

function generate_and_add_browser_entries({page_objects, fileWriter, reframeConfig}) {
    fileWriter.startWriteSession('browser_entries');

    const browser_config_path = generate_reframe_browser_config({fileWriter, reframeConfig});

    Object.values(page_objects)
    .filter(page_object => {
        if( page_object.browser_entry ) {
            return false;
        }
        if( page_object.browser_page_config__source ) {
            return true;
        }
        if( page_object.page_config__source_path && page_object.page_config.domStatic!==true ) {
            return true;
        }
        return false;
    })
    .forEach(page_object => {
        const page_config__source = (
            page_object.browser_page_config__source ||
            page_object.page_config__source_path
        );
        assert_internal(page_config__source);
        const browser_entry__file_name = page_object.page_name+'.generated.entry.js';
        const browser_entry__source_path = generate_browser_entry({fileWriter, page_config__source, browser_entry__file_name, browser_config_path});
        const {entry_name} = get_names(browser_entry__source_path);
        assert_internal(!page_object.browser_entry);
        page_object.browser_entry = {
            entry_name,
            source_path: browser_entry__source_path,
        };
    });

    Object.values(page_objects)
    .filter(page_object => page_object.page_config__source_path && !page_object.browser_entry)
    .forEach(page_object => {
        page_object.browser_entry = {
            entry_name: page_object.page_name+'.noop',
            source_path: page_object.page_config__source_path,
            only_include_style: true,
        };
    });

    fileWriter.endWriteSession();
}

function get_page_files({pagesDirPath}) {
    return (
        fs__ls(pagesDirPath)
        .filter(is_file)
        .filter(is_javascript_file)
        .map(file_path => {
            const {file_name, entry_name, page_name} = get_names(file_path);

            const file_name_parts = file_name.split('.');

            const suffix_dom = file_name_parts.includes('dom');
            const suffix_entry = file_name_parts.includes('entry');
            const suffix_mixin = file_name_parts.includes('mixin');
            const number_of_suffixes = suffix_dom + suffix_entry + suffix_mixin;
            assert_usage(
                number_of_suffixes <= 1,
                "The file `"+file_path+"` has conflicting suffixes.",
                "Choose only one or none of `.html`, `.dom`, `.entry`, or `.html`, or `.mixin`"
            );

            return {
                file_path,
                file_name,
                entry_name,
                page_name,
                is_dom: suffix_dom,
                is_entry: suffix_entry,
                is_base: number_of_suffixes===0,
            };
        })
    );
}

function is_file(file_path) {
    return !fs.lstatSync(file_path).isDirectory();
}

function is_javascript_file(file_path) {
    assert_internal(check('path/to/file.js'));
    assert_internal(check('./file.js'));
    assert_internal(check('file.web.js'));
    assert_internal(check('file.mjs'));
    assert_internal(check('file.jsx'));
    assert_internal(check('file.web.jsx'));
    assert_internal(check('page.entry.jsx'));
    assert_internal(check('page.entry.js'));
    assert_internal(check('page.dom.js'));
    assert_internal(check('page.html.js'));
    assert_internal(check('page.universal.js'));
    assert_internal(!check('page.css'));

    return check(file_path);

    function check(file_path) {
        let mime_type = mime.getType(file_path);
        if( !mime_type ) {
            return true;
        }
        mime_type = mime_type.toLowerCase();
        if( mime_type.includes('coffeescript') ) {
            return true;
        }
        if( mime_type.includes('javascript') ) {
            return true;
        }
        if( mime_type.includes('jsx') ) {
            return true;
        }
        return false;
    }
}

function get_names(file_path) {
    const file_name = path_module.basename(file_path);
    assert_internal(!file_name.includes(path_module.sep));
    const entry_name = file_name.split('.').slice(0, -1).join('.');
    const page_name = file_name.split('.')[0];
    assert_usage(
        entry_name && page_name && file_name,
        "Invalid file name `"+file_path+"`"
    );
    return {file_name, entry_name, page_name};
}

function generate_reframe_browser_config({fileWriter, reframeConfig}) {
    const source_code = [
        "const {processReframeBrowserConfig} = require('@reframe/utils/processReframeConfig/processReframeBrowserConfig');",
        "const browserConfigObject = {};",
        "",
        "browserConfigObject.plugins = [",
        ...(
            reframeConfig._processed.browserConfigs.map(({diskPath}) => {
                assert_internal(path_module.isAbsolute(diskPath), diskPath);
                assert_internal(path_points_to_a_file(diskPath), diskPath);
                return "  require('"+diskPath+"')(),";
            })
        ),
        "];",
        "",
        "processReframeBrowserConfig(browserConfigObject);",
        "",
        "const browserConfig = browserConfigObject._processed;",
        "",
        "module.exports = browserConfig;",
    ].join('\n')

    // TODO rename filename
    const filePath = GENERATED_DIR+'browserConfig.js';

    const fileAbsolutePath = fileWriter.writeFile({
        fileContent: source_code,
        filePath,
    });

    return fileAbsolutePath;
}

function generate_browser_entry({page_config__source, browser_entry__file_name, fileWriter, browser_config_path}) {
    assert_internal(path_module.isAbsolute(page_config__source));
    assert_internal(path_module.isAbsolute(browser_config_path));
    assert_internal(!path_module.isAbsolute(browser_entry__file_name));

    let source_code = (
        [
            "const hydratePage = require('"+require.resolve('@reframe/browser/hydratePage')+"');",
            "const browserConfig = __BROWSER_CONFIG;",
            "",
            "// hybrid cjs and ES6 module import",
            "let pageConfig = __PAGE_CONFIG;",
            "pageConfig = Object.keys(pageConfig).length===1 && pageConfig.default || pageConfig;",
            "",
            "hydratePage(pageConfig, browserConfig);",
        ].join('\n')
    );

    source_code = (
        source_code
        .replace(
            /__BROWSER_CONFIG/g,
            "require('"+browser_config_path+"')"
        )
    );

    source_code = (
        source_code
        .replace(
            /__PAGE_CONFIG/g,
            "require('"+page_config__source+"')"
        )
    );

    const fileAbsolutePath = fileWriter.writeFile({
        fileContent: source_code,
        filePath: GENERATED_DIR+'browser_entries/'+browser_entry__file_name,
    });
    return fileAbsolutePath;
}

async function writeHtmlFiles({fileWriter}) {
    const {pageModules} = this;
    assert_internal(pageModules);

    const htmlFiles = await this.getHtmlFiles(pageModules);
    assert_usage(htmlFiles && htmlFiles.constructor===Array);

    fileWriter.startWriteSession('html_files');

    htmlFiles
    .forEach(({pathname, html}) => {
        assert_input({pathname, html});
        fileWriter.writeFile({
            fileContent: html,
            filePath: get_file_path(pathname),
        });
    });

    fileWriter.endWriteSession();

    return;

    function get_file_path(pathname) {
        assert_internal(pathname.startsWith('/'));
        const file_path__relative = (pathname === '/' ? 'index' : pathname.slice(1))+'.html'
        const file_path = (
            (BROWSER_DIST_DIR+file_path__relative)
            .replace(/\//g, path_module.sep)
        );
        return file_path;
    }

    function assert_input({pathname, html}) {
        assert_usage(html && html.constructor===String, html);

        assert_usage(pathname);
        assert_usage(pathname.startsWith('/'));
    }
}

function enhance_page_objects_1({page_objects, buildState, fileWriter, reframeConfig}) {
    const server_entry_points = buildState.server.output.entry_points;
    load_page_configs({page_objects, server_entry_points});
    generate_and_add_browser_entries({page_objects, fileWriter, reframeConfig});
}

function generatePageBrowserEntries({fileWriter}) {
    const {pageInfos} = this;

    const pageBrowserEntries = {};

    fileWriter.startWriteSession('BROWSER_SOURCE_CODE');

    Object.values(pageInfos)
    .forEach(pageInfo => {
        assert_usage(pageInfo);
        const {browserEntryString, pageName} = pageInfo;

        assert_usage(browserEntryString && browserEntryString.constructor===String);

        const fileAbsolutePath = fileWriter.writeFile({
            fileContent: browserEntryString,
            filePath: GENERATED_DIR+'browser_entries/'+pageName+'-browser.js',
        });

        assert_internal(!pageBrowserEntries[pageName]);
        pageBrowserEntries[pageName] = fileAbsolutePath;
    });

    fileWriter.endWriteSession();

    return pageBrowserEntries;
}

function writeAssetMap({buildState, fileWriter}) {
    const {pageInfos, pageNames, pageModules} = this;
    assert_internal(pageInfos);
    assert_internal(pageNames);

    const assetMap = {};

    addPageFileTranspiled({assetMap, pageModules});

    const browser_entry_points = buildState.browser.output.entry_points;

    add_browser_entry_points({assetMap, pageInfos, browser_entry_points});

    add_autoreload_client({assetMap, pageNames, browser_entry_points});

    assert_assertMap(assetMap);

    fileWriter.writeFile({
        fileContent: JSON.stringify(assetMap, null, 2),
        filePath: 'assetMap.json',
        noSession: true,
    });
}

function addPageFileTranspiled({assetMap, pageModules}) {
    pageModules
    .forEach(({pageName, pageFileTranspiled}) => {
        assert_internal(!assetMap[pageName]);
        assetMap[pageName] = {
            pageFileTranspiled,
        };
    });
}

function assert_assertMap(assetMap) {
    Object.entries(assetMap)
    .forEach(([pageName, pageAssets]) => {
        assert_internal(pageName && pageName!=='undefined');
        [
            ...(pageAssets.scripts||[]),
            ...(pageAssets.styles||[])
        ]
        .forEach(pathname => {
            assert_internal(pathname && pathname.constructor===String && pathname.startsWith('/'), assetMap);
        });
    });
}


function add_autoreload_client({assetMap, pageNames, browser_entry_points}) {
    if( is_production() ) {
        return;
    }
    const entry_point__autoreload = Object.values(browser_entry_points).find(({entry_name}) => entry_name==='autoreload_client');
    if( ! entry_point__autoreload ) {
        return;
    }
    pageNames
    .forEach(pageName => {
        assert_internal(pageName);
        add_entry_point_to_page_assets({entry_point: entry_point__autoreload, assetMap, pageName});
    });
}

function add_browser_entry_points({assetMap, pageInfos, browser_entry_points}) {
    Object.values(browser_entry_points)
    .forEach(entry_point => {
        assert_internal(entry_point.entry_name);
        Object.values(pageInfos)
        .forEach(({browserEntryOnlyCss, pageName}) => {
            assert_usage([true, false].includes(browserEntryOnlyCss));
            assert_internal(pageName);
            if( pageName===entry_point.entry_name ) {
                if( browserEntryOnlyCss ) {
                    add_entry_point_styles_to_page_assets({assetMap, entry_point, pageName});
                } else {
                    add_entry_point_to_page_assets({assetMap, entry_point, pageName});
                }
            }
        });
    });
}

function add_entry_point_to_page_assets({assetMap, entry_point, removeIndex, pageName}) {
    assert_internal(pageName);
    assert_internal(!entry_point.entry_name.split('.').includes('noop'));

    const pageAssets = assetMap[pageName] = assetMap[pageName] || {};

    const {scripts} = entry_point;
    assert_internal(scripts.length>=1, entry_point);

    if( removeIndex!==undefined ) {
        pageAssets.scripts = make_paths_array_unique([
            ...pageAssets.scripts.slice(0, removeIndex),
            ...scripts,
            ...pageAssets.scripts.slice(removeIndex+1)
        ]);
    } else {
        pageAssets.scripts = make_paths_array_unique([
            ...(pageAssets.scripts||[]),
            ...scripts
        ]);
    }

    add_entry_point_styles_to_page_assets({assetMap, entry_point, pageName});
}

function add_entry_point_styles_to_page_assets({assetMap, entry_point, pageName}) {
    assert_internal(pageName);

    const pageAssets = assetMap[pageName] = assetMap[pageName] || {};

    const {styles} = entry_point;
    assert_internal(styles.length>=0, entry_point);

    pageAssets.styles = (
        make_paths_array_unique([
            ...(pageAssets.styles||[]),
            ...styles
        ])
    );
}

function make_paths_array_unique(paths) {
    assert_internal(
        paths.every(
            path => (
                path && path.constructor===Object ||
                path && path.constructor===String && path.startsWith('/')
            )
        ),
        paths
    );
    return [...new Set(paths)];
}

function loadPageModules(server_entry_points) {
    const pageModules = (
        this.pageNames
        .map(pageName => {
            const entryName = pageName;
            const entry_point = server_entry_points[entryName];
            assert_internal(entry_point);
            const pageFileTranspiled = get_script_dist_path(entry_point);
            const pageExport = forceRequire(pageFileTranspiled);
            const pageFile = this.pageFiles[pageName];
            assert_internal(pageFile);
            return {pageName, pageExport, pageFile, pageFileTranspiled};
        })
    );
    return pageModules;
}

function load_page_configs({page_objects, server_entry_points}) {
    require('source-map-support').install();

    Object.values(server_entry_points)
    .map(entry_point => {
        let page_object = Object.values(page_objects).find(page_object => (page_object.server_entry||{}).entry_name===entry_point.entry_name);
        if( ! page_object ) {
            assert_internal(entry_point.source_entry_points.length===1, entry_point)
            page_object = page_objects[entry_point.entry_name] = {
                page_config__source_path: entry_point.source_entry_points[0],
            };
        }
        const script_dist_path = get_script_dist_path(entry_point);
        const page_config = forceRequire(script_dist_path);
        assert_usage(
            page_config && page_config.constructor===Object,
            "The page config, defined at `"+page_object.page_config__source_path+"`, should return a plain JavaScript object.",
            "Instead it returns: `"+page_config+"`."
        );
        assert_usage(
            page_config.route,
            page_config,
            "The page config, printed above and defined at `"+page_object.page_config__source_path+"`, is missing the `route` property."
        );
        page_object.page_config = page_config;
    });

    Object.values(page_objects)
    .forEach(page_object => {
        assert_internal(
            !page_object.page_config__source_path || page_object.page_config,
            page_object,
            server_entry_points,
            page_object.page_config__source_path
        );
    });
}

function get_script_dist_path(entry_point) {
    let script_dist_path;
    entry_point.all_assets.forEach(({asset_type, filepath}) => {
        if( asset_type==='script' ) {
            assert_internal(!script_dist_path, entry_point);
            script_dist_path = filepath;
        }
    });
    assert_internal(script_dist_path, entry_point);
    return script_dist_path;
}

function isProduction() {
    return process.env['NODE_ENV'] === 'production';
}

function path__resolve(p, ...paths) {
    assert_internal(p && path_module.isAbsolute(p), p);
    assert_internal(paths.length>0);
    assert_internal(paths.every(p => !path_module.isAbsolute(p)));
    return path_module.resolve(p, ...paths);
}

function path_points_to_a_file(file_path) {
    try {
        // `require.resolve` throws if `file_path` is not a file
        require.resolve(file_path);
        return true;
    } catch(e) {}
    return false;
}

// TOOD: remove
function fs__ls(dirpath) {
    assert_internal(path_module.isAbsolute(dirpath));
    /*
    const files = dir.files(dirpath, {sync: true, recursive: false});
    */
    const files = (
        fs.readdirSync(dirpath)
        .map(filename => path__resolve(dirpath, filename))
    );
    files.forEach(filepath => {
        assert_internal(path_module.isAbsolute(filepath), dirpath, files);
        assert_internal(path_module.relative(dirpath, filepath).split(path_module.sep).length===1, dirpath, files);
    });
    return files;
}

function is_production() {
   return process.env.NODE_ENV === 'production';
}
