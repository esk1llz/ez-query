import _ from 'lodash';
import $ from 'jquery';

define(function (require) {
  var module = require('ui/modules').get('kibana/ez-query', ['kibana']);
  
  module.controller('KbnEzQueryVisController', function ($scope, $timeout, Private, ezQueryRegistry, getAppState) {
    const queryFilter = Private(require('ui/filter_bar/query_filter'));
    const LinkedVis = Private(require('plugins/ez-query/linkedVis'));
    const appState = getAppState();
    let $queryInput = null;
    let $querySubmit = null;
    let linkedVis = null;

    init();
    const unregisterFunc = ezQueryRegistry.register(function() {
      const selected = getSelectedQueries();
      if (linkedVis) linkedVis.update(selected);
      const queryString = _.map(selected, query => {
        return '(' + query.query + ')';
      }).join(' OR ');
      return queryString;
    });
    $scope.$on('$destroy', function() {
      if (unregisterFunc) unregisterFunc();
    });
    queryFilter.on('update', function() {
      if (!findFilter()) {
        clearSelectedQueries();
      }
    });

    $scope.filter = function() {
      switch($scope.vis.params.filterType) {
        case 'filter':
          const selected = getSelectedQueries();
          if (selected.length === 0) {
            const existingFilter = findFilter();
            if (existingFilter) {
              queryFilter.removeFilter(existingFilter);
            }
          } else {
            setFilter(selected);
          }
          break;
        default:
          setQuery(ezQueryRegistry.buildQuery(), true);
      }
    }

    function setFilter(selected) {
      const alias = selected.map(function(query) {
        return query.name;
      }).join(',');
      const query_string = {
        fields: [$scope.vis.params.field_meta.key],
        query: selected.map(function(query) {
          return query.query;
        }).join(' OR ')
      };

      let existingFilter = findFilter();
      if (existingFilter) {
        queryFilter.updateFilter({
          model: {
            query_string: query_string
          },
          source: existingFilter,
          alias: alias
        });
      } else {
        const newFilter = {
          query_string: query_string,
          meta: {
            alias: alias, 
            negate: false, 
            index: $scope.vis.params.field_meta.indexId, 
            key: $scope.vis.params.field_meta.key 
          }
        }
        queryFilter.addFilters(newFilter);
      }
    }

    function setQuery(queryString, submit) {
      if (!$queryInput) {
        $queryInput = $("input[aria-label='Filter input']");
      }
      if (!$querySubmit) {
        $querySubmit = $("button[aria-label='Filter Dashboards']");
      }

      if ($queryInput && $querySubmit) {
        appState.query.query_string.query = queryString;
        //appState.save();
        $queryInput.val(queryString);
        if (submit) {
          $timeout(function() {
            $querySubmit.trigger('click');
          }, 0);
        }
      }
    }

    function findFilter() {
      let existingFilter = null;
      _.flatten([queryFilter.getAppFilters(), queryFilter.getGlobalFilters()]).forEach(function (it) {
        if (_.has(it, 'query_string.fields') &&
          _.includes(_.get(it, 'query_string.fields', []), $scope.vis.params.field_meta.key)) {
          existingFilter = it;
        }
      });
      return existingFilter;
    }

    function getSelectedQueries() {
      const selected = [];
      switch ($scope.vis.params.buttonType) {
        case 'radio':
          $scope.queries.forEach(query => {
            if (query.query === $scope.radioVal) {
              selected.push(query);
            }
          });
          break;
        case 'checkbox':
          const checked = [];
          _.forOwn($scope.checkboxes, (isChecked, queryName) => {
            if (isChecked) checked.push(queryName);
          });
          $scope.queries.forEach(query => {
            if (_.includes(checked, query.name)) {
              selected.push(query);
            }
          });
          break;
      }
      return selected;
    }

    function clearSelectedQueries() {
      switch ($scope.vis.params.buttonType) {
        case 'radio':
          $scope.radioVal = null;
          break;
        case 'checkbox':
          _.forOwn($scope.checkboxes, (value, key, object) => {
            object[key] = false;
          });
          break;
      }
    }

    function init() {
      $scope.radioVal = '';
      $scope.checkboxes = {};
      switch($scope.vis.params.filterType) {
        case 'filter':
          $scope.queries = $scope.vis.params.filters;
          let existingFilter = findFilter();
          if (existingFilter) {
            $scope.vis.params.filters.forEach(query => {
              if (_.includes(existingFilter.query_string.query, query.query)) {
                $scope.radioVal = query.query;
                $scope.checkboxes[query.name] = true;
              }
            });
          }
          break;
        default:
          $scope.queries = $scope.vis.params.luceneQueries;
          $scope.vis.params.luceneQueries.forEach(query => {
            if (_.includes(appState.query.query_string.query, query.query)) {
              $scope.radioVal = query.query;
              $scope.checkboxes[query.name] = true;
            }
          });
      }

      if ($scope.vis.params.linked) {
        linkedVis = new LinkedVis($scope.vis.params.linkedVis.visId, $scope.vis.params.linkedVis.indexId);
      }
    }
  });
});