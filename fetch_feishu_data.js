const https = require('https');
const fs = require('fs');
const path = require('path');

// 飞书应用配置
const APP_ID = 'cli_a99e950f7ce8101c';
const APP_SECRET = 'aOlbY0Lzvk9NbMjjX77cfc6r7wEddZjm';
const DOMAIN = 'https://open.feishu.cn';

// 获取访问令牌
async function getAccessToken() {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            app_id: APP_ID,
            app_secret: APP_SECRET
        });

        const options = {
            hostname: 'open.feishu.cn',
            port: 443,
            path: '/open-apis/auth/v3/tenant_access_token/internal',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.code === 0) {
                        resolve(response.tenant_access_token);
                    } else {
                        reject(new Error(`获取访问令牌失败: ${response.msg}`));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

// 获取表格数据
async function getTableData(accessToken, appToken, tableId, pageSize = 100, pageToken = '') {
    return new Promise((resolve, reject) => {
        let path = `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=${pageSize}`;
        if (pageToken) {
            path += `&page_token=${pageToken}`;
        }

        const options = {
            hostname: 'open.feishu.cn',
            port: 443,
            path: path,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.code === 0) {
                        resolve(response.data);
                    } else {
                        reject(new Error(`获取表格数据失败: ${response.msg}`));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

// 获取所有表格数据（分页）
async function getAllTableData(accessToken, appToken, tableId) {
    let allRecords = [];
    let pageToken = '';
    let pageCount = 0;

    console.log(`开始获取表格数据...`);

    do {
        pageCount++;
        console.log(`正在获取第 ${pageCount} 页数据...`);

        try {
            const data = await getTableData(accessToken, appToken, tableId, 100, pageToken);
            allRecords = allRecords.concat(data.items || []);
            pageToken = data.page_token || '';

            console.log(`第 ${pageCount} 页获取了 ${data.items?.length || 0} 条记录`);

            // 添加延迟避免API限制
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            console.error(`获取第 ${pageCount} 页数据时出错:`, error.message);
            break;
        }

    } while (pageToken);

    console.log(`总共获取了 ${allRecords.length} 条记录，分 ${pageCount} 页`);
    return allRecords;
}

// 保存数据到文件
function saveDataToFile(data, filename) {
    const outputPath = path.join(__dirname, 'results', 'data', filename);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`数据已保存到: ${outputPath}`);
    return outputPath;
}

// 主函数
async function main() {
    try {
        console.log('开始获取飞书数据...');

        // 获取访问令牌
        console.log('正在获取访问令牌...');
        const accessToken = await getAccessToken();
        console.log('访问令牌获取成功');

        // 第一个表格：体育组线下项目数据表
        console.log('\n=== 获取第一个表格：体育组线下项目数据表 ===');
        const appToken1 = 'WkVXb8p9waedmNsyVVycmVT1nOg';
        const tableId1 = 'tblihAii48rRFAZd';

        const tableData1 = await getAllTableData(accessToken, appToken1, tableId1);
        const outputFile1 = saveDataToFile(tableData1, 'sports_project_data.json');

        // 第二个表格：公司营收支出
        console.log('\n=== 获取第二个表格：公司营收支出 ===');
        const appToken2 = 'Ub5LbXiq8aCjnSsImwNcLw9YnJN';
        const tableId2 = 'tblnnN9qll0lFMqa';

        const tableData2 = await getAllTableData(accessToken, appToken2, tableId2);
        const outputFile2 = saveDataToFile(tableData2, 'company_revenue_expense.json');

        console.log('\n=== 数据获取完成 ===');
        console.log(`第一个表格数据: ${outputFile1}`);
        console.log(`第二个表格数据: ${outputFile2}`);

        // 生成元数据报告
        const metadata = {
            fetch_time: new Date().toISOString(),
            table1: {
                name: '体育组线下项目数据表',
                app_token: appToken1,
                table_id: tableId1,
                total_records: tableData1.length,
                file_path: outputFile1
            },
            table2: {
                name: '公司营收支出',
                app_token: appToken2,
                table_id: tableId2,
                total_records: tableData2.length,
                file_path: outputFile2
            }
        };

        const metadataFile = path.join(__dirname, 'results', 'data', 'fetch_metadata.json');
        fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf8');
        console.log(`元数据已保存到: ${metadataFile}`);

    } catch (error) {
        console.error('获取数据时出错:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();