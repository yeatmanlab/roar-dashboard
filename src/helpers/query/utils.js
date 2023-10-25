import axios from "axios"
import Papa from "papaparse";
import _get from "lodash/get";
import _fromPairs from "lodash/fromPairs";
import _last from "lodash/last";
import _mapValues from "lodash/mapValues";
import _toPairs from "lodash/toPairs";
import _union from "lodash/union";
import _without from "lodash/without";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/store/auth";
import { flattenObj } from "@/helpers";

export const convertValues = (value) => {
  const passThroughKeys = [
    "nullValue",
    "booleanValue",
    "timestampValue",
    "stringValue",
    "bytesValue",
    "referenceValue",
    "geoPointValue",
  ];
  const numberKeys = [
    "integerValue",
    "doubleValue",
  ];
  return _toPairs(value).map(([key, _value]) => {
    if (passThroughKeys.includes(key)) {
      return _value;
    } else if (numberKeys.includes(key)) {
      return Number(_value);
    } else if (key === "arrayValue") {
      return (_value.values ?? []).map((itemValue) => convertValues(itemValue));
    } else if (key === "mapValue") {
      return _fromPairs(_toPairs(_value.fields).map(
        ([mapKey, mapValue]) => [mapKey, convertValues(mapValue)]
      ));
    }
  })[0];
}

export const mapFields = (data, getParentDocId) => {
  const fields = _without(data.map((item) => {
    if (item.document?.fields) {
      const nameSplit = (item.document?.name ?? "").split("/");
      const result = {
        ...item.document?.fields,
        id: { stringValue: _last(nameSplit) },
      };
      if (getParentDocId) {
        result.parentDoc = nameSplit[nameSplit.length - 3];
      }
      return result;
    }
    return undefined;
  }), undefined);
  return fields.map((item) => _mapValues(item, (value) => convertValues(value)));
}

export const orderByDefault = [
  {
    field: { fieldPath: "name" },
    direction: "ASCENDING",
  }
];

export const getAxiosInstance = (db = 'admin') => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  const axiosOptions = _get(roarfirekit.value.restConfig, db) ?? {};
  return axios.create(axiosOptions);
}

export const exportCsv = (data, filename) => {
  const csvData = data.map(flattenObj);
  const csvColumns = _union(...csvData.map(Object.keys));
  const csv = Papa.unparse(csvData, {
    columns: csvColumns,
  });

  const blob = new Blob([csv]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob, { type: 'text/plain' });
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const fetchDocById = async (collection, docId, select) => {
  const docPath = `/${collection}/${docId}`;
  const axiosInstance = getAxiosInstance();
  const queryParams = (select ?? []).map((field) => `mask.fieldPaths=${field}`)
  const queryString = queryParams.length > 0? `?${queryParams.join("&")}` : "";
  return axiosInstance.get(docPath + queryString).then(({ data }) => {
    return {
      id: docId,
      collection,
      ..._mapValues(data.fields, (value) => convertValues(value)),
    };
  });
}
