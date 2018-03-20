const request = require('request');
const fs = require('fs');
const author = '[change with github username]';
const token = '[change with github personal token]';

const BASE_API = 'https://api.github.com';

const query = `
query{
    viewer{
      contributedRepositories(first:100){
        nodes{
          name
          owner {
            login
          }
        }
      }
      repositories(first:100){
              nodes{
          name
          owner {
            login
          }
        }
      }
    }
  }`;

new Promise((resolve, reject) => {
  request.post(
    {
      url: BASE_API + '/graphql',
      json: true,
      headers: {
        Authorization: 'bearer ' + token,
        'User-agent': 'list-commits-agent',
      },
      body: { query },
    },
    (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        resolve(body);
      }
    }
  );
}).then(response => {
  const listRepos = [];
  response.data.viewer.contributedRepositories.nodes.forEach(record => {
    listRepos.push({ name: record.name, owner: record.owner.login });
  });
  console.info(listRepos);

  const date = new Date();
  const today = date.toISOString().slice(0, 11) + '00:00:00Z';
  date.setDate(date.getDate() - 1);
  const yesterday = date.toISOString().slice(0, 11) + '00:00:00Z';

  const promises = [];
  listRepos.forEach(rep => {
    const url = `${BASE_API}/repos/${rep.owner}/${
      rep.name
    }/commits?since=${yesterday}&until=${today}`;

    promises.push(
      new Promise((resolve, reject) => {
        request(
          {
            url,
            json: true,
            headers: {
              Authorization: 'bearer ' + token,
              'User-agent': 'list-commits-agent',
            },
          },
          (err, response, body) => {
            if (err) {
              reject(err);
            } else {
              resolve({ body, rep });
            }
          }
        );
      })
    );
  });

  const results = [];

  Promise.all(promises)
    .then(data => {
      data.forEach(record => {
        const commits = [];
        const commitsResponse = record.body;
        commitsResponse.forEach(commit => {
          if (commit.author && commit.author.login === author) {
            commits.push(commit.commit.message);
          }
        });
        results.push({
          rep: record.rep.owner + '/' + record.rep.name,
          commits,
        });
      });
      let csv = '';
      results.forEach(row => {
        csv += row.rep + ',"' + row.commits.join('|') + '"\n';
      });
      fs.writeFileSync('report.csv', csv);
      console.info(results);
    })
    .catch(err => {
      console.info(err);
    });
});
