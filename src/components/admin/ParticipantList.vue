<template>
	
	<Panel header="Participants" toggleable>
		<template #icons>
			<Button label="Add participants" icon="pi pi-user" size="small" class="p-button-rounded p-button-sm" />
		</template>

		<DataTable v-model:selection="selectedProduct" removable-sort :value="products" data-key="code" table-style="min-width: 50rem">
			<Column selection-mode="multiple" header-style="width: 3rem"></Column>
			<Column field="code" header="Code" sortable></Column>
			<Column field="name" header="Name"></Column>
			<Column field="category" header="Category"></Column>
			<Column field="quantity" header="Quantity"></Column>
		</DataTable>

	</Panel>
	
</template>


<script>
import {ref} from "vue";

import Panel from 'primevue/panel';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ColumnGroup from 'primevue/columngroup';   // optional
import Row from 'primevue/row';                   // optional

const products = ref([
	{
		code: "f230fh0g3",
		name: "f230fh0g3",
		category: "Cat",
		quantity: "qty 1"
	},
	{
		code: "nvklal433",
		name: "nvklal433",
		category: "Cat",
		quantity: "qty 2"
	}
]);

export default {
	data() {
		return {
			products: products,
			selectedProduct: null,
			metaKey: true
		};
	},
	mounted() {
		
	}
};
</script>