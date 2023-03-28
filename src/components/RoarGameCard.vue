<template>
	<Card :id="gameId" :data-completed="completed" class="p-card-game m-4">
		<template #header>
			<div class="p-card-game-details">
				<template v-if="completed">
					<div class="p-card-game-success">
						<i class="pi pi-check-circle"></i>
						<Tag value="Completed" severity="success"></Tag>
					</div>
				</template>
				<template v-else>
					<span>Game x of y</span>	
					<router-link :to="{ path: 'game/' + gameId }"></router-link>
					<div>Play <i class="pi pi-arrow-circle-right"></i></div>
				</template>
			</div>
  			<img :src="imgSrc" />
		</template>
		<template #title>
  			{{title}}
		</template>
		<template #content>
  			{{description}}
		</template>
		<template #footer v-if="metadata">
  			<Tag v-for="(items,index) in metadata" :value="items"></Tag>
		</template>
	</Card>
</template>

<script setup>
	const props = defineProps({
		gameId: {type: String, required: true},
		title: {type:String, required: true},
		description: {type: String, required: true},
		metadata: {type: Object, default: {}},
		imgSrc: {type: String, default: ''},
		completed: {type: Boolean, default: false, required: true}
	});
</script>

<style scoped lang="scss">
	.p-card-game {
		--gray: lightgray;
		--primary: var(--primary-color);
		--success: #16A34A;

		position: relative;
		box-shadow: none;
		border: 1px solid var(--gray);
		text-align: left;
	}
		
	// Game details
	// Contains completed status; game count & play button
	.p-card-game-details {
		background: var(--gray);
		padding: 1rem;
		display: inline-flex;
		align-items: center;
		width: 100%;
		justify-content: space-between;
		border-top-left-radius: .25rem;
		border-top-right-radius: .25rem;
		
		i {
			font-size: 1.25rem;
		}
		
		> div {
			display: inline-flex;
			gap: .5rem;
			align-items: center;
		}


	}
	
	// link
	// this component should have only 1 router link
	a {
		text-decoration: none;
		color: inherit;
		
		&:before {
			content: " ";
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
		}
	}
	
	// Footer
	.p-card-footer {
		
		// override CSS from <Tag>
		.p-tag {
			background: var(--gray);
			margin-right: .5rem;
		}

	}
	
	// Not completed
	[data-completed="false"] {
		
		&:hover {
			border-color: var(--primary);
			color: var(--primary);
			
			.p-card-game-details {
				background: var(--primary);
				color: white;
			}
		
		}
		
	}
	
	
	// Completed
	[data-completed="true"] {
		
		.p-card-game-details {
			background: white;
			color: var(--success);
		}
		
	}

</style>